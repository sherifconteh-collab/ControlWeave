ALTER TABLE ai_decision_log
ADD COLUMN data_lineage TEXT,
ADD COLUMN bias_score FLOAT,
ADD COLUMN review_date DATETIME,
ADD COLUMN approved_by VARCHAR(255);