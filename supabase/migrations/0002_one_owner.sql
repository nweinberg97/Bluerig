-- BR-01: a business has at most one owner. Claiming checks this in code too; the
-- index settles the race if two people verify a code at the same moment.
create unique index if not exists members_one_owner on public.members (business_id) where role = 'owner';
