-- Run on existing projects to permit PDF uploads through the existing private bucket.
update storage.buckets
set file_size_limit = 30000000
where id = 'paper-files' and not public;
