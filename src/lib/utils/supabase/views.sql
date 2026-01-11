DROP VIEW IF EXISTS ordered_bill_splits;

CREATE VIEW ordered_bill_splits 
WITH (security_invoker = TRUE)
AS
SELECT 
    bis.id AS id,
    bis.bill_id,
    bis.ratio,
    bis.item_id,
    bis.contributor_id,
    bi.name AS item_name,
    bc.name AS contributor_name,
    bi.sort AS item_sort_order,
    bc.sort AS contributor_sort_order
FROM bill_item_splits bis
JOIN bill_items bi ON bis.item_id = bi.id
JOIN bill_contributors bc ON bc.id = bis.contributor_id;
