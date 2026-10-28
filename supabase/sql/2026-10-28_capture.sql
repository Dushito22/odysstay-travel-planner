-- Capture: listings the owner saw on Idealista or Immobiliare, sent by his browser extension or Gmail script.
create table if not exists public.capture_tokens (
  token_sha256 text primary key,
  label text not null,
  created_at timestamptz not null default now()
);
alter table public.capture_tokens enable row level security;

insert into public.capture_tokens (token_sha256, label) values ('a8237e0ff4f47c3aeb91046c3784c3444bcedb5d2a91e617af9e9057394270e8', 'owner')
on conflict (token_sha256) do nothing;

insert into public.sources (id, name, country, kind, homepage, description_en) values
  ('idealista', 'Idealista', 'IT', 'private', 'https://www.idealista.it', 'Listings the owner saw on Idealista, captured from his own browser or alert emails.'),
  ('immobiliare', 'Immobiliare.it', 'IT', 'private', 'https://www.immobiliare.it', 'Listings the owner saw on Immobiliare.it, captured from his own browser or alert emails.')
on conflict (id) do nothing;
