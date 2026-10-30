import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20261030000000_initial_schema.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      return new NextResponse(sql, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    return NextResponse.json({ error: 'Migration file not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
