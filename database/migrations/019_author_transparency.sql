ALTER TABLE authors
  ADD COLUMN job_title VARCHAR(150) NULL AFTER display_name,
  ADD COLUMN disclosure TEXT NULL AFTER bio;
