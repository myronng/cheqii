CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- bills
DROP TRIGGER IF EXISTS handle_updated_at ON public.bills;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- bill_contributors
DROP TRIGGER IF EXISTS handle_updated_at ON public.bill_contributors;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.bill_contributors
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- bill_item_splits
DROP TRIGGER IF EXISTS handle_updated_at ON public.bill_item_splits;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.bill_item_splits
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- bill_items
DROP TRIGGER IF EXISTS handle_updated_at ON public.bill_items;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.bill_items
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- bill_users
DROP TRIGGER IF EXISTS handle_updated_at ON public.bill_users;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.bill_users
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- users
DROP TRIGGER IF EXISTS handle_updated_at ON public.users;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
