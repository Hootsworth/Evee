import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

const bucket = 'work-item-attachments';
const allowedTypes = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const maxFileSize = 4 * 1024 * 1024;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    const { id } = await params;
    const admin = createAdminClient();
    const { data: workItem, error: itemError } = await admin.from('work_items').select('id')
      .eq('id', id).eq('organization_id', user.organizationId).maybeSingle();
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
    if (!workItem) return NextResponse.json({ error: 'Work item not found.' }, { status: 404 });

    const attachmentId = req.nextUrl.searchParams.get('attachmentId');
    if (attachmentId) {
      const { data: attachment, error } = await admin.from('work_item_attachments').select('storage_path, file_name')
        .eq('id', attachmentId).eq('organization_id', user.organizationId).eq('work_item_id', id).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!attachment) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
      const { data: signed, error: signedError } = await admin.storage.from(bucket).createSignedUrl(attachment.storage_path, 60, { download: attachment.file_name });
      if (signedError || !signed?.signedUrl) return NextResponse.json({ error: signedError?.message || 'Could not prepare download.' }, { status: 500 });
      return NextResponse.redirect(signed.signedUrl);
    }

    const { data: attachments, error } = await admin.from('work_item_attachments').select('*')
      .eq('organization_id', user.organizationId).eq('work_item_id', id).order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attachments: attachments || [] });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'operator');
    const { id } = await params;
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file to attach.' }, { status: 400 });
    if (!file.size || file.size > maxFileSize) return NextResponse.json({ error: 'Attachments must be between 1 byte and 4 MB.' }, { status: 400 });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: 'Allowed files: PDF, PNG, JPG, WebP, TXT, CSV, DOCX, and XLSX.' }, { status: 400 });

    const admin = createAdminClient();
    const { data: workItem, error: itemError } = await admin.from('work_items').select('id')
      .eq('id', id).eq('organization_id', user.organizationId).maybeSingle();
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
    if (!workItem) return NextResponse.json({ error: 'Work item not found.' }, { status: 404 });

    const originalName = file.name.replace(/[\\/\0-\x1f\x7f]/g, '_').trim().slice(0, 255) || 'attachment';
    const safeName = originalName.replace(/[^a-zA-Z0-9._ -]/g, '_');
    const storagePath = `${user.organizationId}/${id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await admin.storage.from(bucket).upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type, upsert: false,
    });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: attachment, error } = await admin.from('work_item_attachments').insert({
      organization_id: user.organizationId, work_item_id: id, uploaded_by: user.userId,
      storage_path: storagePath, file_name: originalName, content_type: file.type, file_size: file.size,
    }).select('*').single();
    if (error) {
      await admin.storage.from(bucket).remove([storagePath]);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await admin.from('audit_events').insert({ organization_id: user.organizationId, event_type: 'WORK_ITEM_ATTACHMENT_ADDED', entity_type: 'work_items', entity_id: id, details: { attachmentId: attachment.id, fileName: originalName, actorName: user.displayName } });
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserContext(req);
    assertAuthenticated(user);
    assertAuthorized(user, 'operator');
    const { id } = await params;
    const attachmentId = req.nextUrl.searchParams.get('attachmentId');
    if (!attachmentId) return NextResponse.json({ error: 'attachmentId is required.' }, { status: 400 });
    const admin = createAdminClient();
    const { data: attachment, error: loadError } = await admin.from('work_item_attachments').select('id, storage_path, uploaded_by, file_name')
      .eq('id', attachmentId).eq('organization_id', user.organizationId).eq('work_item_id', id).maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!attachment) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
    if (!['admin', 'manager'].includes(user.role) && attachment.uploaded_by !== user.userId) {
      return NextResponse.json({ error: 'You can remove only attachments you uploaded.' }, { status: 403 });
    }
    const { error } = await admin.from('work_item_attachments').delete().eq('id', attachmentId).eq('organization_id', user.organizationId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { error: storageError } = await admin.storage.from(bucket).remove([attachment.storage_path]);
    if (storageError) console.warn('[work-item-attachments] Could not remove stored object:', storageError.message);
    await admin.from('audit_events').insert({ organization_id: user.organizationId, event_type: 'WORK_ITEM_ATTACHMENT_REMOVED', entity_type: 'work_items', entity_id: id, details: { attachmentId, fileName: attachment.file_name, actorName: user.displayName } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
