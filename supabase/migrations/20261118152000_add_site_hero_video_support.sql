alter table public.site_images
  add column if not exists video_url text;

update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'video/mp4'
  ]
where id = 'store-images';
