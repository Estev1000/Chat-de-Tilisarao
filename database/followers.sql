
CREATE TABLE IF NOT EXISTS public.followers (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
    follower_id  INTEGER NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, follower_id)
);