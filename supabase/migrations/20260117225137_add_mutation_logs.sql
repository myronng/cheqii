-- Create mutation_logs table
CREATE TABLE IF NOT EXISTS public.mutation_logs (
    id UUID NOT NULL PRIMARY KEY,
    entity_id UUID NOT NULL,
    mutation_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mutation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only insert their own mutation logs"
  ON public.mutation_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only view their own mutation logs"
  ON public.mutation_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Indices
CREATE INDEX IF NOT EXISTS idx_mutation_logs_user_id ON public.mutation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mutation_logs_entity_id ON public.mutation_logs(entity_id);
