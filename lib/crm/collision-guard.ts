// Evee - Enterprise Opportunity Collision Guard
import { CrmCollisionResult } from './types';
import { getTenantCrmSettings, findCrmOpportunity } from './store';

export async function checkCrmCollision(
  organizationId: string,
  query: {
    email?: string | null;
    domain?: string | null;
    companyName?: string | null;
  }
): Promise<CrmCollisionResult> {
  const settings = await getTenantCrmSettings(organizationId);

  if (!settings.collisionProtectionEnabled) {
    return {
      hasCollision: false,
      accountStatus: 'prospect',
      shouldSuppress: false,
    };
  }

  const opp = findCrmOpportunity(organizationId, query);

  if (!opp) {
    return {
      hasCollision: false,
      accountStatus: 'prospect',
      shouldSuppress: false,
    };
  }

  // Check if opportunity is in a protected stage
  const isProtectedStage = settings.protectedStages.some(
    (s) => s.toLowerCase() === opp.stage.toLowerCase()
  );

  if (opp.isClosedWon) {
    return {
      hasCollision: true,
      accountStatus: 'existing_customer',
      opportunity: opp,
      reason: `Existing Customer Account (${opp.provider.toUpperCase()} Closed Won deal "${opp.name}")`,
      shouldSuppress: settings.autoSuppressColdOutreach,
    };
  }

  if (opp.isClosedLost) {
    return {
      hasCollision: false,
      accountStatus: 'closed_lost',
      opportunity: opp,
      reason: `Previous Closed Lost deal in ${opp.provider.toUpperCase()}`,
      shouldSuppress: false,
    };
  }

  if (isProtectedStage) {
    const amountStr = opp.amount ? ` ($${opp.amount.toLocaleString()})` : '';
    const ownerStr = opp.ownerName ? ` owned by ${opp.ownerName}` : '';
    return {
      hasCollision: true,
      accountStatus: 'active_opportunity',
      opportunity: opp,
      reason: `Active ${opp.provider.toUpperCase()} Deal: "${opp.name}" at stage [${opp.stage}]${amountStr}${ownerStr}`,
      shouldSuppress: settings.autoSuppressColdOutreach,
    };
  }

  return {
    hasCollision: false,
    accountStatus: 'prospect',
    opportunity: opp,
    shouldSuppress: false,
  };
}

/**
 * Annotates an array of leads with their CRM collision status for fast table rendering.
 */
export async function annotateLeadsWithCrmStatus(
  organizationId: string,
  leads: any[]
): Promise<any[]> {
  const settings = await getTenantCrmSettings(organizationId);
  if (!settings.collisionProtectionEnabled) {
    return leads;
  }

  return leads.map((lead) => {
    const domain = lead.canonical_domain || (lead.official_website_url ? lead.official_website_url.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : null);
    const email = lead.general_business_email || lead.contacts?.[0]?.email;
    const companyName = lead.display_name || lead.normalized_name;

    const opp = findCrmOpportunity(organizationId, { domain, email, companyName });
    if (opp) {
      const isProtected = settings.protectedStages.some((s) => s.toLowerCase() === opp.stage.toLowerCase()) || opp.isClosedWon;
      return {
        ...lead,
        crm_collision: {
          hasCollision: isProtected,
          stage: opp.stage,
          dealName: opp.name,
          amount: opp.amount,
          ownerName: opp.ownerName,
          provider: opp.provider,
          isClosedWon: opp.isClosedWon,
        },
      };
    }
    return lead;
  });
}
