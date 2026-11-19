-- Add an operational manager tier between workspace administrators and operators.
ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('admin', 'manager', 'operator', 'viewer'));

-- Keep database authorization aligned with the application role hierarchy.
CREATE OR REPLACE FUNCTION current_user_has_role(p_org_id UUID, p_required_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT om.role INTO v_role
  FROM organization_members om
  WHERE om.organization_id = p_org_id
    AND om.user_id = auth.uid();

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_required_role = 'viewer' THEN
    RETURN v_role IN ('admin', 'manager', 'operator', 'viewer');
  ELSIF p_required_role = 'operator' THEN
    RETURN v_role IN ('admin', 'manager', 'operator');
  ELSIF p_required_role = 'manager' THEN
    RETURN v_role IN ('admin', 'manager');
  ELSIF p_required_role = 'admin' THEN
    RETURN v_role = 'admin';
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
