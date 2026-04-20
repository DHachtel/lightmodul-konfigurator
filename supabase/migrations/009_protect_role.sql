-- Verhindert Rollen-Selbst-Eskalation: Nur Admins dürfen die role-Spalte ändern.
-- Ergänzt den bestehenden protect_discount_pct-Trigger um Rollenschutz.

CREATE OR REPLACE FUNCTION protect_role_and_discount()
RETURNS TRIGGER AS $$
BEGIN
  -- Rolle darf nur von Admins geändert werden
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  -- Rabatt darf nur von Admins geändert werden (bisher in protect_discount_pct)
  IF NEW.discount_pct IS DISTINCT FROM OLD.discount_pct THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      NEW.discount_pct := OLD.discount_pct;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Alten Trigger ersetzen
DROP TRIGGER IF EXISTS profiles_protect_discount_pct ON profiles;
DROP FUNCTION IF EXISTS protect_discount_pct();

CREATE TRIGGER profiles_protect_role_and_discount
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_role_and_discount();
