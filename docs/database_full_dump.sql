-- ============================================================
-- DUMP COMPLETO DO BANCO DE DADOS - ReclamaBuraco
-- Gerado em: 2026-03-15
-- Inclui: Schema + Dados + RLS + Funções + Triggers + Views
-- ============================================================

-- ============================================================
-- 1. EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. TIPOS ENUM
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin_prefeitura', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.complaint_status AS ENUM ('recebida', 'em_andamento', 'resolvida', 'arquivada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.plano_prefeitura AS ENUM ('starter', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_alerta AS ENUM ('enchente', 'chuva_forte', 'alagamento', 'emergencia', 'aviso_geral');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.canal_envio AS ENUM ('whatsapp', 'sms', 'push', 'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_envio AS ENUM ('pendente', 'enviado', 'erro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. TABELAS
-- ============================================================

-- prefeituras
CREATE TABLE IF NOT EXISTS public.prefeituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cidade text NOT NULL,
  estado text NOT NULL DEFAULT 'SC',
  slug text NOT NULL UNIQUE,
  logo_url text,
  cor_primaria text DEFAULT '#1e40af',
  cor_secundaria text DEFAULT '#3b82f6',
  texto_institucional text,
  email_contato text,
  telefone_contato text,
  imagem_capa_url text,
  ativo boolean DEFAULT true,
  plano plano_prefeitura NOT NULL DEFAULT 'starter',
  webhook_secret uuid DEFAULT gen_random_uuid(),
  evolution_api_url text,
  evolution_api_key text,
  evolution_instance_name text,
  evolution_phone text,
  evolution_connected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  nome text,
  email text,
  prefeitura_id uuid REFERENCES public.prefeituras(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  prefeitura_id uuid REFERENCES public.prefeituras(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

-- bairros
CREATE TABLE IF NOT EXISTS public.bairros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- categorias
CREATE TABLE IF NOT EXISTS public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  icone text DEFAULT 'AlertCircle',
  prefeitura_id uuid REFERENCES public.prefeituras(id),
  global boolean DEFAULT false,
  ativo boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- reclamacoes
CREATE TABLE IF NOT EXISTS public.reclamacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  protocolo text NOT NULL,
  nome_cidadao text NOT NULL,
  email_cidadao text NOT NULL,
  telefone_cidadao text,
  bairro_id uuid REFERENCES public.bairros(id),
  categoria_id uuid REFERENCES public.categorias(id),
  rua text NOT NULL,
  numero text,
  referencia text,
  descricao text NOT NULL,
  localizacao jsonb,
  fotos text[] DEFAULT '{}',
  videos text[] DEFAULT '{}',
  status complaint_status DEFAULT 'recebida',
  resposta_prefeitura text,
  visualizada boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- historico_status
CREATE TABLE IF NOT EXISTS public.historico_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reclamacao_id uuid NOT NULL REFERENCES public.reclamacoes(id),
  status_anterior complaint_status,
  status_novo complaint_status NOT NULL,
  observacao text,
  usuario_id uuid,
  created_at timestamptz DEFAULT now()
);

-- cidadaos
CREATE TABLE IF NOT EXISTS public.cidadaos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  telefone text,
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  bairro_id uuid REFERENCES public.bairros(id),
  aceita_alertas boolean DEFAULT true,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- alertas
CREATE TABLE IF NOT EXISTS public.alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  tipo tipo_alerta NOT NULL,
  bairro_id uuid REFERENCES public.bairros(id),
  canais canal_envio[] NOT NULL DEFAULT '{}',
  total_enviados integer DEFAULT 0,
  total_erros integer DEFAULT 0,
  criado_por uuid,
  created_at timestamptz DEFAULT now()
);

-- alerta_envios
CREATE TABLE IF NOT EXISTS public.alerta_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id uuid NOT NULL REFERENCES public.alertas(id),
  cidadao_id uuid NOT NULL REFERENCES public.cidadaos(id),
  canal canal_envio NOT NULL,
  status status_envio DEFAULT 'pendente',
  enviado_em timestamptz,
  erro_mensagem text,
  created_at timestamptz DEFAULT now()
);

-- avaliacoes
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reclamacao_id uuid NOT NULL REFERENCES public.reclamacoes(id),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  estrelas integer NOT NULL,
  comentario text,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  avaliado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- visitas
CREATE TABLE IF NOT EXISTS public.visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagina text NOT NULL,
  prefeitura_id uuid REFERENCES public.prefeituras(id),
  created_at timestamptz DEFAULT now()
);

-- configuracoes_sistema
CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- prefeitura_configuracoes
CREATE TABLE IF NOT EXISTS public.prefeitura_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL UNIQUE REFERENCES public.prefeituras(id),
  sla_padrao_dias integer NOT NULL DEFAULT 7,
  sla_alerta_percentual integer NOT NULL DEFAULT 80,
  sla_alertas_ativos boolean NOT NULL DEFAULT true,
  exigir_foto_padrao boolean NOT NULL DEFAULT false,
  permitir_video boolean NOT NULL DEFAULT true,
  limite_imagens integer NOT NULL DEFAULT 5,
  permitir_anexo boolean NOT NULL DEFAULT false,
  notif_email_ativo boolean NOT NULL DEFAULT true,
  notif_whatsapp_ativo boolean NOT NULL DEFAULT false,
  notif_sistema_ativo boolean NOT NULL DEFAULT true,
  notif_ao_criar boolean NOT NULL DEFAULT true,
  notif_ao_mudar_status boolean NOT NULL DEFAULT true,
  notif_sla_proximo boolean NOT NULL DEFAULT true,
  notif_ao_concluir boolean NOT NULL DEFAULT true,
  avaliacao_nota_destaque integer NOT NULL DEFAULT 4,
  avaliacao_comentarios_publicos boolean NOT NULL DEFAULT false,
  avaliacao_permitir_resposta boolean NOT NULL DEFAULT true,
  avaliacao_obrigatoria boolean NOT NULL DEFAULT false,
  lgpd_anonimizar_relatorios boolean NOT NULL DEFAULT false,
  lgpd_retencao_anos integer NOT NULL DEFAULT 5,
  lgpd_texto_consentimento text DEFAULT 'Ao enviar esta reclamação, você concorda com o tratamento dos seus dados pessoais conforme nossa política de privacidade.',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- upload_queue
CREATE TABLE IF NOT EXISTS public.upload_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  reclamacao_id uuid REFERENCES public.reclamacoes(id),
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- webhook_logs
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  source text NOT NULL DEFAULT 'whatsapp',
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  error_message text,
  reclamacao_id uuid REFERENCES public.reclamacoes(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- whatsapp_conversas
CREATE TABLE IF NOT EXISTS public.whatsapp_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  telefone text NOT NULL,
  nome_cidadao text,
  estado text NOT NULL DEFAULT 'inicio',
  dados_coletados jsonb NOT NULL DEFAULT '{}',
  midias_coletadas jsonb NOT NULL DEFAULT '{"fotos": [], "videos": []}',
  localizacao jsonb,
  reclamacao_id uuid REFERENCES public.reclamacoes(id),
  operador_atendendo_id uuid,
  operador_atendendo_desde timestamptz,
  ultima_mensagem_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- whatsapp_mensagens
CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.whatsapp_conversas(id),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  direcao text NOT NULL,
  tipo text NOT NULL DEFAULT 'texto',
  conteudo text NOT NULL,
  midia_url text,
  enviado_por text,
  operador_id uuid,
  lida boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- whatsapp_templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefeitura_id uuid NOT NULL REFERENCES public.prefeituras(id),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  atalho text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 4. VIEW
-- ============================================================
CREATE OR REPLACE VIEW public.prefeituras_publico AS
SELECT
  id, nome, cidade, estado, slug, logo_url,
  cor_primaria, cor_secundaria, texto_institucional,
  email_contato, telefone_contato, imagem_capa_url,
  ativo, plano, evolution_connected, created_at, updated_at
FROM public.prefeituras;

-- ============================================================
-- 5. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_reclamacoes_protocolo ON public.reclamacoes(protocolo);
CREATE INDEX IF NOT EXISTS idx_reclamacoes_prefeitura ON public.reclamacoes(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_reclamacoes_status ON public.reclamacoes(status);
CREATE INDEX IF NOT EXISTS idx_reclamacoes_created ON public.reclamacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bairros_prefeitura ON public.bairros(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_categorias_prefeitura ON public.categorias(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_cidadaos_prefeitura ON public.cidadaos(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_historico_reclamacao ON public.historico_status(reclamacao_id);
CREATE INDEX IF NOT EXISTS idx_alertas_prefeitura ON public.alertas(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_alerta_envios_alerta ON public.alerta_envios(alerta_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_reclamacao ON public.avaliacoes(reclamacao_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_token ON public.avaliacoes(token);
CREATE INDEX IF NOT EXISTS idx_visitas_prefeitura ON public.visitas(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_prefeitura ON public.webhook_logs(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_prefeitura ON public.whatsapp_conversas(prefeitura_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_telefone ON public.whatsapp_conversas(telefone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_conversa ON public.whatsapp_mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_prefeituras_slug ON public.prefeituras(slug);

-- ============================================================
-- 6. FUNÇÕES
-- ============================================================

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- is_prefeitura_admin
CREATE OR REPLACE FUNCTION public.is_prefeitura_admin(_user_id uuid, _prefeitura_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'admin_prefeitura'
    AND prefeitura_id = _prefeitura_id
  )
$$;

-- generate_protocolo
CREATE OR REPLACE FUNCTION public.generate_protocolo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.protocolo := 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'nome', NEW.email);
  RETURN NEW;
END;
$$;

-- auto_cadastrar_cidadao
CREATE OR REPLACE FUNCTION public.auto_cadastrar_cidadao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cidadao_existente uuid;
BEGIN
  IF NEW.telefone_cidadao IS NOT NULL AND NEW.telefone_cidadao != '' THEN
    SELECT id INTO v_cidadao_existente
    FROM public.cidadaos
    WHERE prefeitura_id = NEW.prefeitura_id
      AND telefone = NEW.telefone_cidadao
    LIMIT 1;
  END IF;

  IF v_cidadao_existente IS NULL AND NEW.email_cidadao IS NOT NULL AND NEW.email_cidadao != '' THEN
    SELECT id INTO v_cidadao_existente
    FROM public.cidadaos
    WHERE prefeitura_id = NEW.prefeitura_id
      AND email = NEW.email_cidadao
    LIMIT 1;
  END IF;

  IF v_cidadao_existente IS NULL THEN
    INSERT INTO public.cidadaos (
      prefeitura_id, nome, email, telefone, bairro_id, aceita_alertas, ativo
    ) VALUES (
      NEW.prefeitura_id, NEW.nome_cidadao, NULLIF(NEW.email_cidadao, ''),
      NULLIF(NEW.telefone_cidadao, ''), NEW.bairro_id, true, true
    );
  END IF;

  RETURN NEW;
END;
$$;

-- criar_reclamacao_publica
CREATE OR REPLACE FUNCTION public.criar_reclamacao_publica(
  _prefeitura_id uuid, _nome_cidadao text, _email_cidadao text, _rua text,
  _telefone_cidadao text DEFAULT NULL, _bairro_id uuid DEFAULT NULL,
  _categoria_id uuid DEFAULT NULL, _numero text DEFAULT NULL,
  _referencia text DEFAULT NULL, _descricao text DEFAULT NULL,
  _localizacao jsonb DEFAULT NULL, _fotos text[] DEFAULT '{}', _videos text[] DEFAULT '{}'
)
RETURNS TABLE(protocolo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text; v_email text; v_rua text; v_descricao text;
  v_fotos text[]; v_videos text[]; v_protocolo text;
BEGIN
  v_nome := trim(coalesce(_nome_cidadao, ''));
  v_email := lower(trim(coalesce(_email_cidadao, '')));
  v_rua := trim(coalesce(_rua, ''));
  v_descricao := trim(coalesce(_descricao, ''));
  v_fotos := coalesce(_fotos, '{}'::text[]);
  v_videos := coalesce(_videos, '{}'::text[]);

  IF _prefeitura_id IS NULL THEN RAISE EXCEPTION 'prefeitura_obrigatoria'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.prefeituras p WHERE p.id = _prefeitura_id AND p.ativo = true) THEN RAISE EXCEPTION 'prefeitura_invalida'; END IF;
  IF v_nome = '' OR length(v_nome) > 120 THEN RAISE EXCEPTION 'nome_invalido'; END IF;
  IF v_email = '' OR length(v_email) > 255 OR v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'email_invalido'; END IF;
  IF v_rua = '' OR length(v_rua) > 200 THEN RAISE EXCEPTION 'rua_invalida'; END IF;
  IF v_descricao = '' THEN v_descricao := 'Sem descrição adicional'; END IF;
  IF length(v_descricao) > 2000 THEN RAISE EXCEPTION 'descricao_longa'; END IF;
  IF _bairro_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bairros b WHERE b.id = _bairro_id AND b.prefeitura_id = _prefeitura_id) THEN RAISE EXCEPTION 'bairro_invalido'; END IF;
  IF _categoria_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categorias c WHERE c.id = _categoria_id AND c.ativo = true AND (c.global = true OR c.prefeitura_id = _prefeitura_id)) THEN RAISE EXCEPTION 'categoria_invalida'; END IF;

  INSERT INTO public.reclamacoes (
    prefeitura_id, nome_cidadao, email_cidadao, telefone_cidadao,
    bairro_id, categoria_id, rua, numero, referencia, descricao, localizacao, fotos, videos
  ) VALUES (
    _prefeitura_id, v_nome, v_email, nullif(trim(coalesce(_telefone_cidadao, '')), ''),
    _bairro_id, _categoria_id, v_rua, nullif(trim(coalesce(_numero, '')), ''),
    nullif(trim(coalesce(_referencia, '')), ''), v_descricao, _localizacao, v_fotos, v_videos
  ) RETURNING reclamacoes.protocolo INTO v_protocolo;

  RETURN QUERY SELECT v_protocolo;
END;
$$;

-- consultar_protocolo
CREATE OR REPLACE FUNCTION public.consultar_protocolo(_protocolo text, _prefeitura_id uuid)
RETURNS TABLE(id uuid, protocolo text, status complaint_status, created_at timestamptz, updated_at timestamptz, categoria_nome text, bairro_nome text, rua text, resposta_prefeitura text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.protocolo, r.status, r.created_at, r.updated_at,
    c.nome as categoria_nome, b.nome as bairro_nome, r.rua, r.resposta_prefeitura
  FROM reclamacoes r
  LEFT JOIN categorias c ON r.categoria_id = c.id
  LEFT JOIN bairros b ON r.bairro_id = b.id
  WHERE r.protocolo = _protocolo AND r.prefeitura_id = _prefeitura_id
$$;

-- consultar_historico_protocolo
CREATE OR REPLACE FUNCTION public.consultar_historico_protocolo(_protocolo text, _prefeitura_id uuid)
RETURNS TABLE(id uuid, status_anterior text, status_novo text, observacao text, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id, h.status_anterior::text, h.status_novo::text, h.observacao, h.created_at
  FROM historico_status h
  JOIN reclamacoes r ON r.id = h.reclamacao_id
  WHERE r.protocolo = _protocolo AND r.prefeitura_id = _prefeitura_id
  ORDER BY h.created_at DESC
$$;

-- get_prefeitura_config_publica
CREATE OR REPLACE FUNCTION public.get_prefeitura_config_publica(_prefeitura_id uuid)
RETURNS TABLE(exigir_foto_padrao boolean, permitir_video boolean, limite_imagens integer, permitir_anexo boolean, lgpd_texto_consentimento text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exigir_foto_padrao, permitir_video, limite_imagens, permitir_anexo, lgpd_texto_consentimento
  FROM prefeitura_configuracoes
  WHERE prefeitura_id = _prefeitura_id
$$;

-- buscar_avaliacao_por_token
CREATE OR REPLACE FUNCTION public.buscar_avaliacao_por_token(_token uuid)
RETURNS TABLE(protocolo text, rua text, bairro_nome text, categoria_nome text, prefeitura_nome text, ja_avaliada boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.protocolo, r.rua, b.nome as bairro_nome, c.nome as categoria_nome, p.nome as prefeitura_nome,
    (a.avaliado_em IS NOT NULL) as ja_avaliada
  FROM avaliacoes a
  JOIN reclamacoes r ON r.id = a.reclamacao_id
  JOIN prefeituras p ON p.id = a.prefeitura_id
  LEFT JOIN bairros b ON b.id = r.bairro_id
  LEFT JOIN categorias c ON c.id = r.categoria_id
  WHERE a.token = _token
$$;

-- submeter_avaliacao
CREATE OR REPLACE FUNCTION public.submeter_avaliacao(_token uuid, _estrelas integer, _comentario text DEFAULT NULL)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _estrelas < 1 OR _estrelas > 5 THEN
    RETURN QUERY SELECT false, 'Avaliação deve ser entre 1 e 5 estrelas';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.avaliacoes WHERE token = _token AND avaliado_em IS NULL) THEN
    RETURN QUERY SELECT false, 'Link de avaliação inválido ou já utilizado';
    RETURN;
  END IF;
  UPDATE public.avaliacoes
  SET estrelas = _estrelas, comentario = NULLIF(TRIM(COALESCE(_comentario, '')), ''), avaliado_em = now()
  WHERE token = _token AND avaliado_em IS NULL;
  RETURN QUERY SELECT true, 'Avaliação enviada com sucesso!';
END;
$$;

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

-- Trigger para gerar protocolo automaticamente
DROP TRIGGER IF EXISTS set_protocolo ON public.reclamacoes;
CREATE TRIGGER set_protocolo
  BEFORE INSERT ON public.reclamacoes
  FOR EACH ROW
  WHEN (NEW.protocolo IS NULL OR NEW.protocolo = '')
  EXECUTE FUNCTION public.generate_protocolo();

-- Trigger para updated_at em reclamacoes
DROP TRIGGER IF EXISTS update_reclamacoes_updated_at ON public.reclamacoes;
CREATE TRIGGER update_reclamacoes_updated_at
  BEFORE UPDATE ON public.reclamacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at em prefeituras
DROP TRIGGER IF EXISTS update_prefeituras_updated_at ON public.prefeituras;
CREATE TRIGGER update_prefeituras_updated_at
  BEFORE UPDATE ON public.prefeituras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at em cidadaos
DROP TRIGGER IF EXISTS update_cidadaos_updated_at ON public.cidadaos;
CREATE TRIGGER update_cidadaos_updated_at
  BEFORE UPDATE ON public.cidadaos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at em prefeitura_configuracoes
DROP TRIGGER IF EXISTS update_prefeitura_configuracoes_updated_at ON public.prefeitura_configuracoes;
CREATE TRIGGER update_prefeitura_configuracoes_updated_at
  BEFORE UPDATE ON public.prefeitura_configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para auto cadastrar cidadão
DROP TRIGGER IF EXISTS auto_cadastrar_cidadao_trigger ON public.reclamacoes;
CREATE TRIGGER auto_cadastrar_cidadao_trigger
  AFTER INSERT ON public.reclamacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cadastrar_cidadao();

-- Trigger para novo usuário (profile)
-- NOTA: Este trigger deve ser criado no schema auth.users
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.prefeituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reclamacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cidadaos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerta_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prefeitura_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- PREFEITURAS
CREATE POLICY "Super admin pode gerenciar prefeituras" ON public.prefeituras FOR ALL TO public USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin pode ver prefeituras completas" ON public.prefeituras FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), id));
CREATE POLICY "Admin prefeitura pode atualizar sua prefeitura" ON public.prefeituras FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), id)) WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), id));

-- PROFILES
CREATE POLICY "Usuário pode ver profile" ON public.profiles FOR SELECT TO public USING (auth.uid() = id OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Usuário pode atualizar seu profile" ON public.profiles FOR UPDATE TO public USING (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "Super admin pode gerenciar roles" ON public.user_roles FOR ALL TO public USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Usuário pode ver suas roles" ON public.user_roles FOR SELECT TO public USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'));

-- BAIRROS
CREATE POLICY "Bairros são públicos para leitura" ON public.bairros FOR SELECT TO public USING (true);
CREATE POLICY "Admin pode gerenciar bairros da sua prefeitura" ON public.bairros FOR ALL TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- CATEGORIAS
CREATE POLICY "Categorias são públicas para leitura" ON public.categorias FOR SELECT TO public USING (true);
CREATE POLICY "Admin pode gerenciar categorias" ON public.categorias FOR ALL TO public USING (has_role(auth.uid(), 'super_admin') OR (prefeitura_id IS NOT NULL AND is_prefeitura_admin(auth.uid(), prefeitura_id)));

-- RECLAMACOES
CREATE POLICY "Admin pode ver reclamações" ON public.reclamacoes FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admins podem criar reclamação" ON public.reclamacoes FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode gerenciar reclamações" ON public.reclamacoes FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- HISTORICO_STATUS
CREATE POLICY "Admin pode ver histórico" ON public.historico_status FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM reclamacoes r WHERE r.id = historico_status.reclamacao_id AND is_prefeitura_admin(auth.uid(), r.prefeitura_id)));
CREATE POLICY "Admin pode criar histórico" ON public.historico_status FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM reclamacoes r WHERE r.id = historico_status.reclamacao_id AND is_prefeitura_admin(auth.uid(), r.prefeitura_id)));

-- CIDADAOS
CREATE POLICY "Admin pode ver cidadãos da sua prefeitura" ON public.cidadaos FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode inserir cidadãos na sua prefeitura" ON public.cidadaos FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode atualizar cidadãos da sua prefeitura" ON public.cidadaos FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode deletar cidadãos da sua prefeitura" ON public.cidadaos FOR DELETE TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- ALERTAS
CREATE POLICY "Admin pode gerenciar alertas da sua prefeitura" ON public.alertas FOR ALL TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- ALERTA_ENVIOS
CREATE POLICY "Admin pode ver envios de alertas da sua prefeitura" ON public.alerta_envios FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM alertas a WHERE a.id = alerta_envios.alerta_id AND is_prefeitura_admin(auth.uid(), a.prefeitura_id)));
CREATE POLICY "Admin pode criar envios de alertas" ON public.alerta_envios FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM alertas a WHERE a.id = alerta_envios.alerta_id AND is_prefeitura_admin(auth.uid(), a.prefeitura_id)));
CREATE POLICY "Admin pode atualizar envios de alertas" ON public.alerta_envios FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM alertas a WHERE a.id = alerta_envios.alerta_id AND is_prefeitura_admin(auth.uid(), a.prefeitura_id)));

-- AVALIACOES
CREATE POLICY "Admin pode ver avaliações" ON public.avaliacoes FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode criar avaliação" ON public.avaliacoes FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- VISITAS
CREATE POLICY "Qualquer pessoa pode registrar visita" ON public.visitas FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admin pode ver visitas" ON public.visitas FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin') OR (prefeitura_id IS NOT NULL AND is_prefeitura_admin(auth.uid(), prefeitura_id)));

-- CONFIGURACOES_SISTEMA
CREATE POLICY "Super admin pode gerenciar configurações" ON public.configuracoes_sistema FOR ALL TO public USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin pode ver configurações" ON public.configuracoes_sistema FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin'));

-- PREFEITURA_CONFIGURACOES
CREATE POLICY "Admin pode ver configurações da sua prefeitura" ON public.prefeitura_configuracoes FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode criar configurações da sua prefeitura" ON public.prefeitura_configuracoes FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode atualizar configurações da sua prefeitura" ON public.prefeitura_configuracoes FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- UPLOAD_QUEUE
CREATE POLICY "Anyone can insert to upload queue" ON public.upload_queue FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Prefeitura admins can view their uploads" ON public.upload_queue FOR SELECT TO public USING (is_prefeitura_admin(auth.uid(), prefeitura_id) OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Service role can update uploads" ON public.upload_queue FOR UPDATE TO public USING (true) WITH CHECK (true);

-- WEBHOOK_LOGS
CREATE POLICY "Admin pode ver logs de webhook da sua prefeitura" ON public.webhook_logs FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- WHATSAPP_CONVERSAS
CREATE POLICY "Admin pode gerenciar conversas da sua prefeitura" ON public.whatsapp_conversas FOR ALL TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode ver conversas da sua prefeitura" ON public.whatsapp_conversas FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- WHATSAPP_MENSAGENS
CREATE POLICY "Admin pode ver mensagens da sua prefeitura" ON public.whatsapp_mensagens FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode inserir mensagens da sua prefeitura" ON public.whatsapp_mensagens FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));
CREATE POLICY "Admin pode atualizar mensagens da sua prefeitura" ON public.whatsapp_mensagens FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- WHATSAPP_TEMPLATES
CREATE POLICY "Admin pode gerenciar templates da sua prefeitura" ON public.whatsapp_templates FOR ALL TO public USING (has_role(auth.uid(), 'super_admin') OR is_prefeitura_admin(auth.uid(), prefeitura_id));

-- ============================================================
-- 9. STORAGE BUCKET
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('reclamacoes-media', 'reclamacoes-media', true) ON CONFLICT DO NOTHING;
-- CREATE POLICY "Acesso público de leitura" ON storage.objects FOR SELECT USING (bucket_id = 'reclamacoes-media');
-- CREATE POLICY "Upload autenticado" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reclamacoes-media');
-- CREATE POLICY "Admin pode deletar" ON storage.objects FOR DELETE USING (bucket_id = 'reclamacoes-media');

-- ============================================================
-- 10. DADOS - INSERT STATEMENTS
-- ============================================================

-- 10.1 PREFEITURAS
INSERT INTO public.prefeituras (id, nome, cidade, estado, slug, logo_url, cor_primaria, cor_secundaria, texto_institucional, email_contato, telefone_contato, imagem_capa_url, ativo, plano, webhook_secret, evolution_api_url, evolution_api_key, evolution_instance_name, evolution_phone, evolution_connected, created_at, updated_at) VALUES
('fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'Prefeitura de Biguaçu', 'Biguaçu', 'SC', 'biguacu', 'https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/logos/fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7.png', '#1e40af', '#3b82f6', 'A Prefeitura de Biguaçu está comprometida em melhorar a infraestrutura urbana da cidade.', NULL, NULL, 'https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/capas/fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7.png', true, 'pro', '26e96aa6-4a64-4ce8-89f1-31d0ead78748', 'https://sleepyraven-evolution.cloudfy.live', 'E0A80EF6533B-4B6D-BF03-C791672EABE4', 'prefeitura-biguacu', NULL, false, '2025-12-15 22:09:02.137123+00', '2025-12-15 22:09:02.137123+00')
ON CONFLICT (id) DO NOTHING;

-- 10.2 PROFILES
-- NOTA: Profiles são criados automaticamente pelo trigger handle_new_user.
-- Os usuários devem ser criados via auth.users primeiro.
-- Abaixo estão os profiles existentes para referência:
INSERT INTO public.profiles (id, nome, email, prefeitura_id, created_at, updated_at) VALUES
('cf249e84-40dd-4a8b-b051-0e583acb8ef2', 'paolo brancaglione', 'paolobrancaglione2@gmail.com', NULL, '2025-12-15 22:46:57.264885+00', '2025-12-15 22:46:57.264885+00'),
('0583abf8-60b4-4380-b3f8-b8a92f34beab', 'Paolo Brancaglione', 'brancaglionep@gmail.com', NULL, '2025-12-16 00:47:09.13722+00', '2025-12-16 00:47:09.13722+00'),
('3ca074e4-e4c1-4bc3-809b-5fd409428ec6', 'Vitor Hugo', 'paolobrancaglione@gmail.com', NULL, '2025-12-16 12:09:58.3501+00', '2025-12-16 12:09:58.3501+00'),
('f72c1994-97fb-4ecd-8d88-efde9a5f264d', 'Prefeitura de Florianópolis', 'finalwebsc@gmail.com', NULL, '2025-12-21 18:14:51.666856+00', '2025-12-21 18:14:51.666856+00'),
('a36b23d1-7083-4b1e-be51-e033383ba13d', 'Leticia Daminelli', 'leticia.daminelli@hotmail.com', NULL, '2026-01-04 17:43:12.397297+00', '2026-01-04 17:43:12.397297+00'),
('23411e96-7c36-4bfc-874d-33dfef99698f', 'Dyonathan Trento', 'dyonathanctrento@gmail.com', NULL, '2026-01-06 03:44:08.782404+00', '2026-01-06 03:44:08.782404+00')
ON CONFLICT (id) DO NOTHING;

-- 10.3 USER_ROLES
-- NOTA: user_id referencia auth.users que deve ser criado separadamente
INSERT INTO public.user_roles (id, user_id, role, prefeitura_id, created_at) VALUES
('e5ea9791-d915-437f-85bc-a9172bb0a26f', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', 'admin_prefeitura', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', '2025-12-15 22:46:57.493305+00'),
('61fe6704-bcd4-4b81-9c7f-3d921abeb5be', '0583abf8-60b4-4380-b3f8-b8a92f34beab', 'super_admin', NULL, '2025-12-16 00:47:49.805567+00'),
('23b06f5d-0320-4749-bb5f-b2502fc5a700', '23411e96-7c36-4bfc-874d-33dfef99698f', 'admin_prefeitura', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', '2026-01-06 03:44:09.144468+00')
ON CONFLICT (id) DO NOTHING;

-- 10.4 BAIRROS
INSERT INTO public.bairros (id, nome, prefeitura_id, ativo, created_at) VALUES
('9e898fb7-30d8-4c21-82eb-4aad33791386', 'Centro', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('cd49e203-76ad-46fe-bc51-c20193366f50', 'Fundos', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('ccadd0a5-acb4-4497-9904-627e1f03ac17', 'Jardim Janaína', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('ca638f2d-f352-4ccd-8ff0-77bf8846fa43', 'Vendaval', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('9365e3ea-965f-42f4-9ae6-6a9022bd6f66', 'Prado', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('45f43431-5d49-4c0c-a770-79aea0fa3a7b', 'Serraria', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('b5893816-adc3-4923-8eab-1494535800cf', 'Jardim Carandaí', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('6c7e99da-deaf-4fc0-9615-b78f280a77cf', 'Bom Viver', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('11c54a26-a4e5-4a7f-b783-cd174f3ead2b', 'Rio Caveiras', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('6fe9c1c5-0cd6-4989-b353-68d2b985a9c5', 'Três Riachos', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('76a77e53-49bc-4c85-ade3-0002992b9813', 'Guaporanga', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('bed82ab2-d651-4e82-b526-e6bfa2d80d3b', 'Sorocaba do Sul', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('92d76da2-5095-44d5-9b8d-8d6fb3f7f1c3', 'Tijuquinhas', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('360b1fc7-92c7-4889-9d3f-a1cc9e89351d', 'Praia de São Miguel', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00'),
('59862246-130e-4912-aa9e-27676b1b6f3a', 'Bela Vista', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', true, '2025-12-15 22:09:02.137123+00')
ON CONFLICT (id) DO NOTHING;

-- 10.5 CATEGORIAS
INSERT INTO public.categorias (id, nome, descricao, icone, prefeitura_id, global, ativo, ordem, created_at) VALUES
('8f2d827f-5443-4295-b2df-e74c1560c625', 'Buraco na rua', 'Buracos, crateras ou depressões no asfalto', 'CircleOff', NULL, true, true, 0, '2025-12-15 22:09:02.137123+00'),
('56fdd1de-3d07-4573-b7a8-229e9513576f', 'Asfalto danificado', 'Rachaduras, ondulações ou desgaste no asfalto', 'Construction', NULL, true, true, 1, '2025-12-15 22:09:02.137123+00'),
('e470a352-f7d0-4e17-aa6e-a114c4f2216e', 'Calçada quebrada', 'Calçadas com buracos ou irregularidades', 'Footprints', NULL, true, true, 2, '2025-12-15 22:09:02.137123+00'),
('a9debd9c-6c7e-4bd9-99b1-5443573570bb', 'Drenagem/Alagamento', 'Problemas de escoamento de água', 'Droplets', NULL, true, true, 3, '2025-12-15 22:09:02.137123+00'),
('672d8638-481d-488e-b6c1-4661c6bd21a4', 'Sinalização', 'Placas danificadas ou faltando', 'SignpostBig', NULL, true, true, 4, '2025-12-15 22:09:02.137123+00'),
('0d5f7468-9dad-4a5e-bca2-698d0029280e', 'Outro', 'Outros problemas urbanos', 'HelpCircle', NULL, true, true, 5, '2025-12-15 22:09:02.137123+00'),
('823188ee-6715-4cec-83f8-f0c9a247be2b', 'Boeiro entupido', 'Boeiro, Boca de Lobo, Fuga', 'AlertCircle', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', false, true, 1, '2026-01-05 23:42:09.079532+00')
ON CONFLICT (id) DO NOTHING;

-- 10.6 RECLAMACOES
INSERT INTO public.reclamacoes (id, prefeitura_id, protocolo, nome_cidadao, email_cidadao, telefone_cidadao, bairro_id, categoria_id, rua, numero, referencia, descricao, localizacao, fotos, videos, status, resposta_prefeitura, visualizada, created_at, updated_at) VALUES
('850de769-0bf2-4efd-82a2-08010ba6b527', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251215-1642', 'paolo brancaglione', 'paolobrancaglione2@gmail.com', '(48) 99173-4885', '11c54a26-a4e5-4a7f-b783-cd174f3ead2b', '56fdd1de-3d07-4573-b7a8-229e9513576f', 'rua fernando martinho de souza', '188', 'frente ao mercado x', 'buraco na rua', NULL, '{}', '{}', 'arquivada', 'Recebemos a reclamação e ela esta em andamento para iniciarmos!', false, '2025-12-15 23:11:51.287126+00', '2025-12-15 23:11:51.287126+00'),
('85e6a591-0e29-406b-9954-561be61e2b9f', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251215-3831', 'Lidiane Pereira', 'lidi@lid.com', '(48) 99191-0329', '9365e3ea-965f-42f4-9ae6-6a9022bd6f66', 'e470a352-f7d0-4e17-aa6e-a114c4f2216e', 'Pereira são leopoldo', '592', 'Em fente ao mercado vitória', 'muito grande', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1765841251791-bnga88.jpg'], '{}', 'resolvida', 'Recebido sua reclamação e está em andamento!', false, '2025-12-15 23:27:33.92014+00', '2025-12-15 23:27:33.92014+00'),
('e6f21368-aec1-4557-8d96-3738eafe85b6', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251216-0024', 'paolo brancaglione', 'paolobrancaglione2@gmail.com', '(48) 99173-4885', '6c7e99da-deaf-4fc0-9615-b78f280a77cf', '8f2d827f-5443-4295-b2df-e74c1560c625', 'Rua fernando martinho de souza', '188', 'Ao lado do colegio infantil', 'Tem um buraco gigante na frente da minha casa', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1765889764952-n61xab.jpg'], '{}', 'resolvida', NULL, false, '2025-12-16 12:56:08.425969+00', '2025-12-16 12:56:08.425969+00'),
('d477e61e-42d9-4114-be42-b13d3921ef69', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251216-5694', 'joao pessoa', 'paolobrancaglione2@gmail.com', '(48) 99191-0329', 'cd49e203-76ad-46fe-bc51-c20193366f50', '56fdd1de-3d07-4573-b7a8-229e9513576f', 'joao pessoa', '8754', 'sdsf', 'asd asd as54d64as d64 sa54d5as', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1765886195344-s4ib8.jpg'], '{}', 'recebida', NULL, true, '2025-12-16 11:56:38.284955+00', '2025-12-16 11:56:38.284955+00'),
('68267c5e-0444-4335-a73f-d4e3ac87c101', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251216-2311', 'fernando costa', 'fernado@hotmail.com', '(48) 99191-0329', '9e898fb7-30d8-4c21-82eb-4aad33791386', '56fdd1de-3d07-4573-b7a8-229e9513576f', 'Rua Frederico Bunn', '54', 'hjfgjghdfv', 'jhrfghkg', '{"lat": -27.492880288948093, "lng": -48.65431188793142}', ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1765928310275-bpu4d9.jpg'], '{}', 'resolvida', 'Sua demanda sera resolvida terca feira', false, '2025-12-16 23:38:41.682821+00', '2025-12-16 23:38:41.682821+00'),
('ac834671-25e4-4513-aaf0-5620986c58ab', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251217-2535', 'Fernando Mendes', 'mendespht@gmail.com', '(48) 98416-3223', '6c7e99da-deaf-4fc0-9615-b78f280a77cf', '8f2d827f-5443-4295-b2df-e74c1560c625', 'Rua vidal mendes', '41', 'Em frente ao outeiro da ju', 'Hfjsnekxjhdichd', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1765982066019-zklekq.jpg'], ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/videos/1765982067375-v21urw.mov'], 'resolvida', NULL, false, '2025-12-17 14:34:31.350614+00', '2025-12-17 14:34:31.350614+00'),
('93243bdd-1ab0-4a0f-9c46-8c802b5f5ffd', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251217-6380', 'Guilhermo soares', 'ghui@hotmail.com', '(48) 99173-4885', '9e898fb7-30d8-4c21-82eb-4aad33791386', '8f2d827f-5443-4295-b2df-e74c1560c625', 'Rua Barão do Rio Branco', '324', 'dsfsd', 'dsfsdfsd', '{"lat": -27.494110875592952, "lng": -48.656483888626106}', ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1765982475105-h12cdv.jpg'], '{}', 'resolvida', 'Sua reclamção foi Atendida no dia 17/12 as 11:42', false, '2025-12-17 14:41:20.318902+00', '2025-12-17 14:41:20.318902+00'),
('cd2e379c-9fd3-41f6-8ae2-926cfb9966a4', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251217-9283', 'paolo dener brancaglione', 'brancaglionep@gmail.com', '(48) 99173-4885', '9e898fb7-30d8-4c21-82eb-4aad33791386', '56fdd1de-3d07-4573-b7a8-229e9513576f', 'Rua joao amorim rosa', '129', 'ao lado da litoral', 'Gratera enorme da via', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1766003866055-2vgzol.png'], '{}', 'arquivada', NULL, false, '2025-12-17 20:37:52.233197+00', '2025-12-17 20:37:52.233197+00'),
('d4acf88a-7f42-43de-b950-2085dbe7e28e', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251217-2975', 'paolo brancaglione', 'paolobrancaglione2@gmail.com', '(48) 99173-4885', '6c7e99da-deaf-4fc0-9615-b78f280a77cf', '56fdd1de-3d07-4573-b7a8-229e9513576f', 'Rua 7 de setembro', '125', 'rua 7', 'Buraco na via', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1766006118249-2di7rp.png'], '{}', 'resolvida', NULL, false, '2025-12-17 21:15:25.305276+00', '2025-12-17 21:15:25.305276+00'),
('6fc120ab-cce8-4dd2-a94e-6e2bad199ccf', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251219-1532', 'Leticia Daminelli', 'paolobrancaglione2@gmail.com', '(48) 99191-0329', '9e898fb7-30d8-4c21-82eb-4aad33791386', 'a9debd9c-6c7e-4bd9-99b1-5443573570bb', 'Rua 7 de setembro', '150', 'ali na frente', 'dasfsdfsdfsdf', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1766102929441-49xhml.png'], '{}', 'resolvida', NULL, false, '2025-12-19 00:08:53.822323+00', '2025-12-19 00:08:53.822323+00'),
('bc4d326a-f4aa-4352-9f0b-44ce8a8571b7', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251219-2568', 'Ricardo Bark', 'brancaglionep@gmail.com', '(48) 99191-0329', '9e898fb7-30d8-4c21-82eb-4aad33791386', 'a9debd9c-6c7e-4bd9-99b1-5443573570bb', 'Rua João Amorim Rosa', '129', 'Ao lado da litoral', 'Teste 002', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1766146092744-xob7nr.png'], '{}', 'resolvida', NULL, false, '2025-12-19 12:08:22.084977+00', '2025-12-19 12:08:22.084977+00'),
('511bb7c2-aab7-465a-bb46-fddee77e10a5', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251219-2423', 'paolo brancaglione', 'brancaglionep@gmail.com', '(48) 99191-0329', '9e898fb7-30d8-4c21-82eb-4aad33791386', 'a9debd9c-6c7e-4bd9-99b1-5443573570bb', 'Rua dos açores', '159', 'ali', 'sdfsdfsdf', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1766146651127-7e87jc.png'], '{}', 'resolvida', NULL, false, '2025-12-19 12:17:40.157858+00', '2025-12-19 12:17:40.157858+00'),
('d2b4fbf0-ae4f-49ec-8626-cd6851b61fe3', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251221-0837', 'paolo brancaglione', 'brancaglionep@gmail.com', '(48) 99191-0329', '59862246-130e-4912-aa9e-27676b1b6f3a', '8f2d827f-5443-4295-b2df-e74c1560c625', 'Rua joao pessoa', '125', 'em frente ao bac', '65ds4f65ds4f654ds654fsd654f65sd65f4ds654f65ds4f65sd465f4ds65f4ds6 4ds654f6ds54f65 ds4f65ds465f4d6s54f65ds4f65sd4f6 5', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1766341449017-06u0zt.png'], '{}', 'resolvida', NULL, false, '2025-12-21 18:24:11.154357+00', '2025-12-21 18:24:11.154357+00'),
('39a315d6-0bb0-4eaa-b06f-740d11699698', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251221-5824', 'Brendow Cesar', 'brancaglionep@gmail.com', '(48) 99191-0329', '59862246-130e-4912-aa9e-27676b1b6f3a', 'e470a352-f7d0-4e17-aa6e-a114c4f2216e', 'rua 7', '15', 'ali', 'dsfsdfsdf sdfdsf', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1766342081426-il3h3s.png'], '{}', 'resolvida', NULL, false, '2025-12-21 18:34:44.477623+00', '2025-12-21 18:34:44.477623+00'),
('bda9a575-ae21-413f-b098-af7de1532f74', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251221-5922', 'paolo brancaglione', 'paolobrancaglione2@gmail.com', '(48) 99173-4885', '59862246-130e-4912-aa9e-27676b1b6f3a', 'a9debd9c-6c7e-4bd9-99b1-5443573570bb', 'Rua 7', '152', 'teste de envio webhook', 'teste de envio hebhook', NULL, '{}', '{}', 'resolvida', NULL, false, '2025-12-21 22:53:38.793292+00', '2025-12-21 22:53:38.793292+00'),
('fb79b29d-637e-4ac2-a0c5-617f7db26e29', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251221-2363', 'paolo brancaglione', 'paolobrancaglione2@gmail.com', '(48) 99173-4885', '9e898fb7-30d8-4c21-82eb-4aad33791386', '56fdd1de-3d07-4573-b7a8-229e9513576f', 'sdf', 'dsf', 'sdf', 'dsfs', NULL, '{}', '{}', 'resolvida', NULL, false, '2025-12-21 22:57:27.891321+00', '2025-12-21 22:57:27.891321+00'),
('ae90353e-87b8-4622-84ba-d2df475e76f7', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251222-3153', 'paolo dener', 'mendespht@gmail.com', NULL, 'b5893816-adc3-4923-8eab-1494535800cf', '672d8638-481d-488e-b6c1-4661c6bd21a4', 'rua 7', '456', 'fghjuiokjh', 'dfffgf', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1766362954393-dr1zio.jpg'], '{}', 'resolvida', NULL, false, '2025-12-22 00:22:41.413445+00', '2025-12-22 00:22:41.413445+00'),
('ffbb64a9-449f-4c19-b2a3-2f3d01a17123', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251224-4957', 'Marcos Brancaglione', 'marcus@gmail.com', '(48) 00000-0000', '11c54a26-a4e5-4a7f-b783-cd174f3ead2b', 'e470a352-f7d0-4e17-aa6e-a114c4f2216e', 'Rua fernano martinho de souza', '125', 'em frente a casa', 'dfsdsfnffdddfg', NULL, '{}', '{}', 'resolvida', NULL, false, '2025-12-24 22:39:32.450714+00', '2025-12-24 22:39:32.450714+00'),
('0f099276-5203-4123-891e-f729d9a36d0f', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251228-7885', 'Paolo Brancaglione', 'paolobrancaglione@gmail.com', '554891910329', '11c54a26-a4e5-4a7f-b783-cd174f3ead2b', 'a9debd9c-6c7e-4bd9-99b1-5443573570bb', 'Aldo Alfredo Fermiano', '6', NULL, 'cano estourado', NULL, ARRAY['https://mmg.whatsapp.net/o1/v/t24/f2/m238/AQOFwCqsnqH0CBNT4VudEsRqpJWcgAKLMqA5Na1NDczsaLSrcM8RJHkTKOfKuaJGdEn-INcYhlJHTIL4uFHzDdTMUG3LDGq5WXw_MkH6Ow?ccb=9-4&oh=01_Q5Aa3QE6dh5EkHz4R3lmiwTl1Uh8jqTsa46YFJGzJ-yVQbDxuw&oe=69793392&_nc_sid=e6ed6c&mms3=true'], '{}', 'arquivada', NULL, false, '2025-12-28 23:31:37.40826+00', '2025-12-28 23:31:37.40826+00'),
('c9611f61-8c91-4650-b055-1c00f264eeaf', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251229-9424', 'Fernando Mendes', 'mendespht@gmail.com', '554884163223', 'ca638f2d-f352-4ccd-8ff0-77bf8846fa43', '8f2d827f-5443-4295-b2df-e74c1560c625', 'Rua das Pirocas', '41', NULL, 'Buraco enorme, o prefeito não faz nada a 4 anos', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/whatsapp/fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7/1766969909373-3A08EC18.jpeg'], '{}', 'resolvida', NULL, false, '2025-12-29 00:59:23.009334+00', '2025-12-29 00:59:23.009334+00'),
('6ce44c47-91d5-438e-a316-fdcbc7498f1a', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260104-8227', 'Paolo Brancaglione', 'brancaglionep@gmail.com', '554891910329', '11c54a26-a4e5-4a7f-b783-cd174f3ead2b', '56fdd1de-3d07-4573-b7a8-229e9513576f', 'Fernando Martinho de Souza', '189', NULL, 'o asfalto esta com buracos e perigo para carros', NULL, '{}', '{}', 'resolvida', NULL, false, '2026-01-04 19:21:53.417198+00', '2026-01-04 19:21:53.417198+00'),
('0f0a0617-81d3-4d11-be3a-8d96577b4988', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260104-0034', 'Fernando Mendes', 'mendespht@gmail.com', '554884163223', '59862246-130e-4912-aa9e-27676b1b6f3a', '8f2d827f-5443-4295-b2df-e74c1560c625', 'Vidal Mendes', '41', NULL, 'Ksidjjdiwjdijd', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/whatsapp/fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7/1767555015248-3AB8CF7E.jpeg'], '{}', 'resolvida', NULL, false, '2026-01-04 19:30:59.72983+00', '2026-01-04 19:30:59.72983+00'),
('6db5027c-41ff-4be5-b686-23ff4b95b839', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260105-7485', 'Dyonathan Trento', 'dyonathanctrento@gmail.com', '(48) 98447-5143', 'ccadd0a5-acb4-4497-9904-627e1f03ac17', 'a9debd9c-6c7e-4bd9-99b1-5443573570bb', 'Rua Doutor Tancredo Neves', '1173', 'em frente ao mercado', 'boca de lobo entupida', '{"lat": -27.522658481348728, "lng": -48.640530109405525}', ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1767654104307-2t698.JPG'], '{}', 'resolvida', NULL, true, '2026-01-05 23:01:48.57645+00', '2026-01-05 23:01:48.57645+00'),
('c60aef99-17b0-4a8f-aa44-92f361504fc9', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260105-8246', 'Dyonathan', 'dyonathanctrento@gmail.com', '554884475143', NULL, 'e470a352-f7d0-4e17-aa6e-a114c4f2216e', 'Rua Geral', 'Próximo ao 99', NULL, 'A calçada está quebrada. Quebraram ela.', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/whatsapp/fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7/1767654477619-3A5969DC.jpeg'], '{}', 'arquivada', NULL, false, '2026-01-05 23:08:20.278117+00', '2026-01-05 23:08:20.278117+00'),
('bd6b72fc-2f54-4b91-b6f4-f9deb23cebc3', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260105-4418', 'Dyonathan Trento', 'dyonathanctrento@gmail.com', '554884475143', '9e898fb7-30d8-4c21-82eb-4aad33791386', '56fdd1de-3d07-4573-b7a8-229e9513576f', 'Lúcio Born', 'S/N', NULL, 'Há um buraco na rua', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/whatsapp/fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7/1767656700293-3A0A6115.jpeg'], '{}', 'resolvida', NULL, true, '2026-01-05 23:45:15.462501+00', '2026-01-05 23:45:15.462501+00'),
('305fb7c7-f0dc-4dcb-8c25-fc0424660400', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260106-9316', 'Vinicius', 'jdjdj@hejs.com', '554899879476', '9365e3ea-965f-42f4-9ae6-6a9022bd6f66', '823188ee-6715-4cec-83f8-f0c9a247be2b', 'Luiz Dalmolin', 'S/N', NULL, 'Sem mais detalhes', NULL, '{}', '{}', 'resolvida', NULL, true, '2026-01-06 01:44:29.412807+00', '2026-01-06 01:44:29.412807+00'),
('652eb832-ce89-4cad-b05a-04162635fd17', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260106-7969', 'paolo brancaglione', 'paolobrancaglione2@gmail.com', '(48) 99191-0329', '59862246-130e-4912-aa9e-27676b1b6f3a', '56fdd1de-3d07-4573-b7a8-229e9513576f', 'Rua sao joao', '154', 'ali na frente', 'testando', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/fotos/1767664775511-cfgpck.jpg'], '{}', 'resolvida', NULL, true, '2026-01-06 01:59:38.329103+00', '2026-01-06 01:59:38.329103+00'),
('f426dbe9-602a-4478-a692-a0734a1f1aea', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260106-2341', 'Dyonathan', 'dyonathanctrento@gmail.com', '554884475143', '9e898fb7-30d8-4c21-82eb-4aad33791386', '672d8638-481d-488e-b6c1-4661c6bd21a4', 'São Jose', 'S/N', NULL, 'Falta placa para a lombada', NULL, ARRAY['https://sfsjtljhrelctpxpzody.supabase.co/storage/v1/object/public/reclamacoes-media/whatsapp/fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7/1767705033159-3A07459D.jpeg'], '{}', 'resolvida', NULL, true, '2026-01-06 13:12:54.939882+00', '2026-01-06 13:12:54.939882+00')
ON CONFLICT (id) DO NOTHING;

-- Reclamacoes adicionais (via WhatsApp e outras)
INSERT INTO public.reclamacoes (id, prefeitura_id, protocolo, nome_cidadao, email_cidadao, telefone_cidadao, bairro_id, categoria_id, rua, numero, referencia, descricao, localizacao, fotos, videos, status, resposta_prefeitura, visualizada, created_at, updated_at) VALUES
('9077b843-56e3-465c-9d44-f6b572ecd904', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20251229-0001', 'Letícia Daminelli', 'leticia@gmail.com', '554896400426', '9e898fb7-30d8-4c21-82eb-4aad33791386', NULL, 'Rua teste', NULL, NULL, 'Reclamação via WhatsApp', NULL, '{}', '{}', 'resolvida', NULL, false, '2025-12-29 00:14:30+00', '2025-12-29 00:14:30+00'),
('edde5986-394e-44dc-af39-efbed9901d95', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260104-0001', 'Paolo Brancaglione', 'brancaglionep@gmail.com', '554891910329', '9e898fb7-30d8-4c21-82eb-4aad33791386', '8f2d827f-5443-4295-b2df-e74c1560c625', 'João Born', NULL, NULL, 'buraco na rua', NULL, '{}', '{}', 'resolvida', NULL, false, '2026-01-04 19:14:39+00', '2026-01-04 19:14:39+00'),
('b0d14ea4-9d20-412f-8580-f3fe3de197ef', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260104-0002', 'teste', 'teste@teste.com', NULL, NULL, NULL, 'Rua teste', NULL, NULL, 'teste', NULL, '{}', '{}', 'resolvida', NULL, false, '2026-01-04 19:00:00+00', '2026-01-04 19:00:00+00'),
('15c8fb12-2bec-4d4c-83e1-360ebaeed899', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260104-0003', 'teste2', 'teste2@teste.com', NULL, NULL, NULL, 'Rua teste2', NULL, NULL, 'teste2', NULL, '{}', '{}', 'resolvida', NULL, false, '2026-01-04 19:00:01+00', '2026-01-04 19:00:01+00'),
('8069c35a-2066-4970-bdd5-b04ecc9051da', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260104-0004', 'teste3', 'teste3@teste.com', NULL, NULL, NULL, 'Rua teste3', NULL, NULL, 'teste3', NULL, '{}', '{}', 'resolvida', NULL, false, '2026-01-04 19:00:02+00', '2026-01-04 19:00:02+00'),
('424c911c-f823-493e-b657-05615e1f9969', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260104-0005', 'teste4', 'teste4@teste.com', NULL, NULL, NULL, 'Rua teste4', NULL, NULL, 'teste4', NULL, '{}', '{}', 'resolvida', NULL, false, '2026-01-04 19:00:03+00', '2026-01-04 19:00:03+00'),
('d9b29339-9430-4aeb-94a1-15ec0530f70d', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'REC-20260104-0006', 'teste5', 'teste5@teste.com', NULL, NULL, NULL, 'Rua teste5', NULL, NULL, 'teste5', NULL, '{}', '{}', 'resolvida', NULL, false, '2026-01-04 19:00:04+00', '2026-01-04 19:00:04+00')
ON CONFLICT (id) DO NOTHING;

-- 10.7 CIDADAOS
INSERT INTO public.cidadaos (id, nome, email, telefone, prefeitura_id, bairro_id, aceita_alertas, ativo, created_at, updated_at) VALUES
('07adc76b-2a92-4e23-a2ad-80c421ed93be', 'Leticia Damineli', 'leticia@gmail.com', '(48) 98544-2154', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', '59862246-130e-4912-aa9e-27676b1b6f3a', true, true, '2025-12-21 17:51:42.748737+00', '2025-12-21 17:51:42.748737+00'),
('80a37f55-97f1-405f-85e5-08046aa79250', 'paolo brancaglione', 'paolobrancaglione2@gmail.com', '(48) 99173-4885', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', '59862246-130e-4912-aa9e-27676b1b6f3a', true, true, '2025-12-21 22:53:38.793292+00', '2025-12-21 22:53:38.793292+00'),
('1f0028f0-5cd9-4b59-923f-9d4b7c242dcd', 'paolo dener', 'mendespht@gmail.com', NULL, 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'b5893816-adc3-4923-8eab-1494535800cf', true, true, '2025-12-22 00:22:41.413445+00', '2025-12-22 00:22:41.413445+00'),
('80f92421-dbd0-4fd4-b8f4-1c3c0a5f66d0', 'Marcos Brancaglione', 'marcus@gmail.com', '(48) 00000-0000', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', '11c54a26-a4e5-4a7f-b783-cd174f3ead2b', true, true, '2025-12-24 22:39:32.450714+00', '2025-12-24 22:39:32.450714+00'),
('789c208d-3674-4814-8e92-850ea593bb9d', 'Paolo Brancaglione', 'paolobrancaglione@gmail.com', '554891910329', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', '11c54a26-a4e5-4a7f-b783-cd174f3ead2b', true, true, '2025-12-28 23:31:37.40826+00', '2025-12-28 23:31:37.40826+00'),
('fa2508de-f01e-4bfb-8e8c-ff2aaab03096', 'Dyonathan Trento', 'dyonathanctrento@gmail.com', '(48) 98447-5143', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'ccadd0a5-acb4-4497-9904-627e1f03ac17', true, true, '2026-01-05 23:01:48.57645+00', '2026-01-05 23:01:48.57645+00'),
('f4ffcee1-5ee2-4c86-9e07-312b49c34840', 'Vinicius', 'jdjdj@hejs.com', '554899879476', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', '9365e3ea-965f-42f4-9ae6-6a9022bd6f66', true, true, '2026-01-06 01:44:29.412807+00', '2026-01-06 01:44:29.412807+00'),
('67ed62a2-2eee-4f04-a287-27cd908e2f4d', 'paolo brancaglione', 'brancaglionep@gmail.com', '(48) 99191-0329', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', '9e898fb7-30d8-4c21-82eb-4aad33791386', true, true, '2025-12-19 12:17:40.157858+00', '2026-02-27 11:54:19.919882+00')
ON CONFLICT (id) DO NOTHING;

-- 10.8 HISTORICO_STATUS
INSERT INTO public.historico_status (id, reclamacao_id, status_anterior, status_novo, observacao, usuario_id, created_at) VALUES
('c79a400f-00aa-49ee-8c21-5f8a7302b3ff', '850de769-0bf2-4efd-82a2-08010ba6b527', 'recebida', 'em_andamento', 'Resposta atualizada', NULL, '2025-12-15 23:13:26.11784+00'),
('45ceda20-6d59-47b4-90e2-b62155a327d9', '85e6a591-0e29-406b-9954-561be61e2b9f', 'recebida', 'em_andamento', 'Resposta atualizada', NULL, '2025-12-15 23:35:15.089552+00'),
('caf178e8-212a-4c94-98ac-826de6a5cc08', '85e6a591-0e29-406b-9954-561be61e2b9f', 'em_andamento', 'resolvida', 'Resposta atualizada', NULL, '2025-12-16 11:20:26.553068+00'),
('b0b093b5-7f52-4a51-a212-527a5bf98637', '68267c5e-0444-4335-a73f-d4e3ac87c101', 'recebida', 'em_andamento', 'Resposta atualizada', NULL, '2025-12-16 23:42:14.424328+00'),
('a8030821-5f3c-4f45-9f50-bd575f0203ba', '93243bdd-1ab0-4a0f-9c46-8c802b5f5ffd', 'recebida', 'resolvida', 'Resposta atualizada', NULL, '2025-12-17 14:43:05.861876+00'),
('583a470d-fa94-41e4-aae1-df22a1fed059', 'cd2e379c-9fd3-41f6-8ae2-926cfb9966a4', 'recebida', 'em_andamento', NULL, NULL, '2025-12-17 20:42:36.17112+00'),
('83fcd9bb-a9c9-491c-abb9-6f3982f6e089', 'cd2e379c-9fd3-41f6-8ae2-926cfb9966a4', 'em_andamento', 'resolvida', NULL, NULL, '2025-12-17 20:50:34.99988+00'),
('1d791706-c795-4437-8093-2a3b30e213f5', 'cd2e379c-9fd3-41f6-8ae2-926cfb9966a4', 'resolvida', 'arquivada', NULL, NULL, '2025-12-17 20:54:08.208786+00'),
('f123bfb9-c2aa-47ba-a1f6-2fe14e5c745c', 'd4acf88a-7f42-43de-b950-2085dbe7e28e', 'recebida', 'em_andamento', NULL, NULL, '2025-12-17 21:17:55.241394+00'),
('f9b34f29-cfe7-466b-a5d2-587b95f068da', 'd4acf88a-7f42-43de-b950-2085dbe7e28e', 'em_andamento', 'resolvida', NULL, NULL, '2025-12-17 21:18:18.295245+00'),
('058e5e44-48ca-43f9-8626-b21f330950f0', '6fc120ab-cce8-4dd2-a94e-6e2bad199ccf', 'recebida', 'em_andamento', NULL, NULL, '2025-12-19 00:10:29.408257+00'),
('c913e9d5-7be4-4e6e-ba7e-750e8e3e7d4d', '6fc120ab-cce8-4dd2-a94e-6e2bad199ccf', 'em_andamento', 'resolvida', NULL, NULL, '2025-12-19 00:10:52.39322+00'),
('3a169565-a2a9-4a77-b6dc-06d7d23882b0', '511bb7c2-aab7-465a-bb46-fddee77e10a5', 'recebida', 'resolvida', NULL, NULL, '2025-12-19 15:34:21.619033+00'),
('081e4af6-3c0f-4042-850d-4d065b57a4e0', 'bc4d326a-f4aa-4352-9f0b-44ce8a8571b7', 'recebida', 'resolvida', NULL, NULL, '2025-12-19 15:35:28.761716+00'),
('dac7f4c5-6aa4-4172-9ebb-2b12052c33bd', '850de769-0bf2-4efd-82a2-08010ba6b527', 'em_andamento', 'em_andamento', 'olá teste', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-21 17:46:47.369604+00'),
('3212ccd2-4212-4a83-98f8-8bfd82a97647', '850de769-0bf2-4efd-82a2-08010ba6b527', 'em_andamento', 'arquivada', 'Status alterado de "Em Andamento" para "Arquivada"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-21 17:46:52.675409+00'),
('46fe5d8b-c85b-4770-8b16-70082d1e03ed', 'd2b4fbf0-ae4f-49ec-8626-cd6851b61fe3', 'recebida', 'em_andamento', NULL, NULL, '2025-12-21 18:26:54.850327+00'),
('53bdb1be-7307-4b74-be0f-0a34ac4b0b2e', 'd2b4fbf0-ae4f-49ec-8626-cd6851b61fe3', 'em_andamento', 'resolvida', NULL, NULL, '2025-12-21 18:27:17.90771+00'),
('30a4b6fe-7f23-4897-a918-d93ae43fde06', '39a315d6-0bb0-4eaa-b06f-740d11699698', 'recebida', 'resolvida', NULL, NULL, '2025-12-21 18:35:05.949919+00'),
('84017472-c99a-460b-9ca4-84a706da389a', 'ae90353e-87b8-4622-84ba-d2df475e76f7', 'recebida', 'em_andamento', NULL, NULL, '2025-12-22 00:42:10.026651+00'),
('2ca74e5c-6cc5-4b40-b90d-d94b1d2df107', 'ae90353e-87b8-4622-84ba-d2df475e76f7', 'em_andamento', 'resolvida', NULL, NULL, '2025-12-22 00:43:03.218825+00'),
('1badb648-3de1-439d-a65c-26e52332d57f', 'ffbb64a9-449f-4c19-b2a3-2f3d01a17123', 'recebida', 'resolvida', NULL, NULL, '2025-12-24 22:41:01.623948+00'),
('3c61a010-c566-495a-b3d5-76b9a8244e30', '0f099276-5203-4123-891e-f729d9a36d0f', 'recebida', 'em_andamento', NULL, NULL, '2025-12-28 23:54:52.920573+00'),
('5422284c-9832-43a0-bf93-c91635e42da5', '0f099276-5203-4123-891e-f729d9a36d0f', 'em_andamento', 'resolvida', NULL, NULL, '2025-12-28 23:56:39.663409+00'),
('f27487ec-98ba-4125-bb88-94bb1ac2091f', '0f099276-5203-4123-891e-f729d9a36d0f', 'resolvida', 'arquivada', NULL, NULL, '2025-12-28 23:57:09.732605+00'),
('86e71006-48c1-40e9-ab86-c571bbdfa0b7', 'c9611f61-8c91-4650-b055-1c00f264eeaf', 'recebida', 'em_andamento', NULL, NULL, '2025-12-29 01:01:19.776475+00'),
('b4c22fe4-88cb-48a2-86c8-6bff6cbcf8a5', 'c9611f61-8c91-4650-b055-1c00f264eeaf', 'em_andamento', 'resolvida', NULL, NULL, '2025-12-29 01:01:39.885894+00'),
('4a188d8d-10c5-4646-87bd-5377aff007ba', '0f0a0617-81d3-4d11-be3a-8d96577b4988', 'recebida', 'em_andamento', NULL, NULL, '2026-01-05 22:47:31.766523+00'),
('ed8c265b-3d6c-43eb-a2e0-600edcb9ab25', '0f0a0617-81d3-4d11-be3a-8d96577b4988', 'em_andamento', 'resolvida', NULL, NULL, '2026-01-05 22:47:55.960525+00'),
('eadfea4c-16fe-4161-9ebb-21069a4c5c11', 'c60aef99-17b0-4a8f-aa44-92f361504fc9', 'recebida', 'resolvida', NULL, NULL, '2026-01-05 23:09:38.36502+00'),
('0046f473-acd7-411c-9c14-10f1976669da', 'c60aef99-17b0-4a8f-aa44-92f361504fc9', 'resolvida', 'arquivada', 'Status alterado de "Resolvida" para "Arquivada"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-05 23:30:08.042958+00'),
('d8e3fddf-a3a6-4bf2-a236-c853411de92d', 'f426dbe9-602a-4478-a692-a0734a1f1aea', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:13.351222+00'),
('a59287ce-9ff1-4f3c-9c82-4844aa67c2c0', '652eb832-ce89-4cad-b05a-04162635fd17', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:16.978611+00'),
('12d4747e-91fd-4144-a7e0-7a982f5544b6', 'bd6b72fc-2f54-4b91-b6f4-f9deb23cebc3', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:20.560457+00'),
('e88dde02-1e5a-435f-a217-89596b39d65f', '305fb7c7-f0dc-4dcb-8c25-fc0424660400', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:30.335741+00'),
('bd53abfa-05a1-45c7-80fc-392784a91f3f', '6db5027c-41ff-4be5-b686-23ff4b95b839', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:34.48607+00'),
('c7b8d45a-0b3e-45ab-a815-6cca6b797825', '6ce44c47-91d5-438e-a316-fdcbc7498f1a', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:38.182713+00'),
('24b9e54f-cc1d-426f-8437-1e037441c1eb', 'b0d14ea4-9d20-412f-8580-f3fe3de197ef', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:41.412961+00'),
('8dc30b97-fb8c-428f-83c7-d49427b2325a', 'd9b29339-9430-4aeb-94a1-15ec0530f70d', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:44.208341+00'),
('ebbf2c11-39c7-450e-8292-518a3a970b81', '15c8fb12-2bec-4d4c-83e1-360ebaeed899', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:46.88257+00'),
('e1f37d2d-d3a2-4718-a140-837892e71f2b', '8069c35a-2066-4970-bdd5-b04ecc9051da', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:49.887537+00'),
('074444d3-1dd8-4816-a6a2-aa136afe32ed', '9077b843-56e3-465c-9d44-f6b572ecd904', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:52.817663+00'),
('875cdea9-5b49-437b-927c-75ccec91d3bd', '424c911c-f823-493e-b657-05615e1f9969', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:56.323493+00'),
('591fb09f-7a9d-41a1-a4b5-c1548b6811fa', 'fb79b29d-637e-4ac2-a0c5-617f7db26e29', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:44:59.196617+00'),
('d71257ac-f273-470f-85be-c7554fe06719', 'bda9a575-ae21-413f-b098-af7de1532f74', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:45:01.89719+00'),
('3ce0628a-1ab5-46cb-a562-95f16f05c732', 'edde5986-394e-44dc-af39-efbed9901d95', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:45:04.95645+00'),
('d4150853-2aa1-4920-a951-9a53138518df', 'ac834671-25e4-4513-aaf0-5620986c58ab', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:45:30.77345+00'),
('236b64b9-73cb-4493-98b1-6b4a0b715f27', '68267c5e-0444-4335-a73f-d4e3ac87c101', 'em_andamento', 'resolvida', 'Status alterado de "Em Andamento" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:45:33.319726+00'),
('80742d4e-3c5c-4777-800d-bef09f5b12aa', 'e6f21368-aec1-4557-8d96-3738eafe85b6', 'recebida', 'resolvida', 'Status alterado de "Recebida" para "Resolvida"', 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-15 11:45:36.887905+00')
ON CONFLICT (id) DO NOTHING;

-- 10.9 AVALIACOES
INSERT INTO public.avaliacoes (id, reclamacao_id, prefeitura_id, estrelas, comentario, token, avaliado_em, created_at) VALUES
('971e22ac-9f28-4c77-9c9a-aa33a8f014cd', 'd4acf88a-7f42-43de-b950-2085dbe7e28e', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 5, 'Atendimento foi rapido e eficaz!', '828e47b8-3a80-4752-84f1-3bc2ed12d887', '2025-12-17 21:20:59.021183+00', '2025-12-17 21:18:18.560122+00'),
('0e42216b-04d0-4379-9bf7-14555e169123', '6fc120ab-cce8-4dd2-a94e-6e2bad199ccf', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 5, 'Serviço foi feito rápido e com copetencia!', '91512f75-5a2a-431f-8081-b60aca6d9b47', '2025-12-19 00:12:56.527244+00', '2025-12-19 00:10:52.651583+00'),
('cb06355f-962e-4981-9f9d-982788688b46', '511bb7c2-aab7-465a-bb46-fddee77e10a5', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 5, NULL, 'f80bb8ef-d35c-42d6-8d74-f98c355659ef', NULL, '2025-12-19 15:34:21.90454+00'),
('e803b3b2-2801-4746-9a10-57da0592f348', 'bc4d326a-f4aa-4352-9f0b-44ce8a8571b7', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 4, NULL, 'b975ddc0-4148-498e-8518-133302dd0f17', '2025-12-19 15:35:55.251337+00', '2025-12-19 15:35:29.000975+00'),
('98822d1e-2134-4d1e-931e-02de03b369f7', 'd2b4fbf0-ae4f-49ec-8626-cd6851b61fe3', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 5, NULL, 'c9081629-1cac-4818-a00b-3d33c399a8cf', NULL, '2025-12-21 18:27:18.182195+00'),
('5df51f35-d79d-424d-a959-5156b8e2c8ec', '39a315d6-0bb0-4eaa-b06f-740d11699698', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 5, NULL, '0eec5c25-39e6-4144-90ba-c35f95de2a30', NULL, '2025-12-21 18:35:06.187895+00'),
('95dce181-e5cc-433e-af23-a29b4fc4d816', 'ae90353e-87b8-4622-84ba-d2df475e76f7', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 1, 'teste 2', 'e02d6cff-07ff-4b6a-b691-da90ffe38cc1', '2025-12-22 00:46:37.386011+00', '2025-12-22 00:43:03.577035+00'),
('99dd1770-d462-43d8-b3f5-56e53cd25994', 'ffbb64a9-449f-4c19-b2a3-2f3d01a17123', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 5, NULL, '2bbf9246-6b4b-47ce-a2d5-c2362a2e4c41', NULL, '2025-12-24 22:41:02.064538+00'),
('a4af6229-e8f6-416a-86f2-2afde112f70c', '0f099276-5203-4123-891e-f729d9a36d0f', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 5, NULL, '90fb1446-d361-482d-b15d-f53cff865003', NULL, '2025-12-28 23:56:39.918853+00'),
('6e67a270-438b-4750-b840-c9e12d958c9c', 'c9611f61-8c91-4650-b055-1c00f264eeaf', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 1, 'Uma bosta', '16bce12a-6c4c-43aa-8e0d-2b505ff56a8a', '2025-12-29 01:02:08.027225+00', '2025-12-29 01:01:40.160224+00'),
('742f9dff-38d7-495d-bdff-f701d59177de', '0f0a0617-81d3-4d11-be3a-8d96577b4988', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 4, 'Gdgfhdf', '2a2307d1-6035-4953-874c-184606180111', '2026-01-05 22:48:30.987506+00', '2026-01-05 22:47:56.511747+00'),
('1ab13173-a664-483d-8fcb-80c4108d3281', 'c60aef99-17b0-4a8f-aa44-92f361504fc9', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 5, NULL, '942bcc81-91d7-4e53-87e2-b70bea780b91', '2026-01-05 23:26:11.517421+00', '2026-01-05 23:09:38.92112+00')
ON CONFLICT (id) DO NOTHING;

-- 10.10 CONFIGURACOES_SISTEMA
INSERT INTO public.configuracoes_sistema (id, chave, valor, created_at, updated_at) VALUES
('e33f5a96-5c41-41e8-a107-9862c68c5814', 'evolution_api', '{"url": "https://sleepyraven-evolution.cloudfy.live", "api_key": "k5JH7NSpZkVXij9rII1ebVjyctOrhWgE"}', '2025-12-28 22:25:55.260324+00', '2026-01-06 03:18:22.705199+00')
ON CONFLICT (id) DO NOTHING;

-- 10.11 PREFEITURA_CONFIGURACOES
INSERT INTO public.prefeitura_configuracoes (id, prefeitura_id, sla_padrao_dias, sla_alerta_percentual, sla_alertas_ativos, exigir_foto_padrao, permitir_video, limite_imagens, permitir_anexo, notif_email_ativo, notif_whatsapp_ativo, notif_sistema_ativo, notif_ao_criar, notif_ao_mudar_status, notif_sla_proximo, notif_ao_concluir, avaliacao_nota_destaque, avaliacao_comentarios_publicos, avaliacao_permitir_resposta, avaliacao_obrigatoria, lgpd_anonimizar_relatorios, lgpd_retencao_anos, lgpd_texto_consentimento, created_at, updated_at) VALUES
('04db209c-fec9-4ee5-980f-c913093de688', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 7, 80, true, false, true, 3, true, true, true, true, true, true, true, true, 4, false, true, false, false, 0, 'Ao enviar esta reclamação, você concorda com o tratamento dos seus dados pessoais conforme nossa política de privacidade.', '2025-12-21 17:40:45.155692+00', '2025-12-25 01:59:07.034343+00')
ON CONFLICT (id) DO NOTHING;

-- 10.12 ALERTAS
INSERT INTO public.alertas (id, prefeitura_id, titulo, mensagem, tipo, bairro_id, canais, total_enviados, total_erros, criado_por, created_at) VALUES
('2b99e351-fa25-47ea-91ed-7a69ae070f7c', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'Teste de Alerta', 'Estou testando para ver se pega este alerta', 'aviso_geral', NULL, '{sms}', 1, 0, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-19 12:18:51.569358+00'),
('b4b76991-d280-4ad7-9969-4ee8cc33b7b0', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'teste', 'testando a mensagem', 'aviso_geral', NULL, '{sms}', 0, 1, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-19 12:33:16.216835+00'),
('0bfb782a-4bbf-4d63-9b1c-05d03481c39c', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'teste', 'dfsdfsdfsdfsd', 'aviso_geral', NULL, '{whatsapp}', 0, 1, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-19 12:33:48.783668+00'),
('3030829a-e9d0-4449-899b-ab672f1fcc8a', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'teste', 'rfggdfgfdgfdgfd', 'aviso_geral', NULL, '{push}', 0, 1, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-19 12:49:34.971505+00'),
('693ac10a-1ad0-4aa3-92b8-a83ecdf96b10', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'teste', 'asdasdasdsadas', 'aviso_geral', NULL, '{email}', 0, 1, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-19 12:50:26.921273+00'),
('ce014066-d798-4ec2-b151-4b118f7b9b20', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'teste', 'Cuidado chuva intensa', 'aviso_geral', NULL, '{email}', 1, 0, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-19 12:53:59.812976+00'),
('c82cea2d-96f8-4a12-9d06-968f82b47af9', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'teste', 'buraco na rua 7', 'aviso_geral', NULL, '{sms}', 0, 1, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-21 16:18:36.1199+00'),
('7c3fffae-03a5-4e36-ae8a-d8b5804a4fbe', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'Teste SMS Vonage', 'Este é um teste de envio de SMS utilizando a API da Vonage.', 'aviso_geral', NULL, '{sms}', 0, 1, NULL, '2025-12-21 16:40:31.855232+00'),
('dd8a8e05-a340-4511-905b-0df58cc727e4', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'testando o alerta', 'estamos testando o alerta na descrição;áo', 'aviso_geral', NULL, '{email}', 4, 0, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-22 00:33:13.570815+00'),
('890c1391-9db8-4336-a75f-c2c5127d5e45', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'Testando Alerta', E'🚨 ALERTA DE ENCHENTE – BIGUAÇU\n\nAtenção, moradores de Biguaçu.\nDevido ao alto volume de chuvas, há risco de enchente em algumas regiões do município.\n\n⚠️ Evite áreas alagadas\n⚠️ Não atravesse ruas com água corrente\n⚠️ Redobre a atenção com crianças e idosos\n⚠️ Acompanhe os comunicados oficiais\n\nEm caso de emergência, procure um local seguro e acione os órgãos competentes.\nSeguimos monitorando a situação.', 'enchente', NULL, '{whatsapp}', 0, 6, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-29 04:40:25.294018+00'),
('38f1788a-999d-48b5-bee1-e7cba7de5134', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'Testando Alerta', E'🚨 ALERTA DE ENCHENTE – BIGUAÇU\n\nAtenção, moradores de Biguaçu.\nDevido ao alto volume de chuvas, há risco de enchente em algumas regiões do município.\n\n⚠️ Evite áreas alagadas\n⚠️ Não atravesse ruas com água corrente\n⚠️ Redobre a atenção com crianças e idosos\n⚠️ Acompanhe os comunicados oficiais\n\nEm caso de emergência, procure um local seguro e acione os órgãos competentes.\nSeguimos monitorando a situação.', 'enchente', NULL, '{whatsapp}', 3, 3, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-29 04:42:12.005544+00'),
('cb7196cc-31db-4e00-aa8e-3c6b4b835d74', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'Testando Alerta 02', E'Atenção, moradores de Biguaçu.\nDevido ao alto volume de chuvas, há risco de enchente em algumas regiões do município.\n\n⚠️ Evite áreas alagadas\n⚠️ Não atravesse ruas com água corrente\n⚠️ Redobre a atenção com crianças e idosos\n⚠️ Acompanhe os comunicados oficiais\n\nEm caso de emergência, procure um local seguro e acione os órgãos competentes.\nSeguimos monitorando a situação.', 'enchente', NULL, '{whatsapp}', 3, 3, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2025-12-29 04:45:44.742397+00'),
('18cef165-4fa4-433b-a4bd-8dda532a21c0', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'Chuva Inten', 'Tomem cuidado com a chuva vai chuve', 'chuva_forte', NULL, '{whatsapp}', 4, 3, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-05 23:03:43.76369+00'),
('1d5488e1-19c0-4d18-ba06-c7de2c9cdc69', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'Titulo teste', 'Tomem cuidado com o alagamento ( testo texte )', 'alagamento', NULL, '{whatsapp}', 5, 3, 'cf249e84-40dd-4a8b-b051-0e583acb8ef2', '2026-01-09 02:31:15.465175+00')
ON CONFLICT (id) DO NOTHING;

-- 10.13 WHATSAPP_TEMPLATES
INSERT INTO public.whatsapp_templates (id, prefeitura_id, titulo, conteudo, atalho, ordem, ativo, created_at, updated_at) VALUES
('20058427-bcf4-491f-a4a5-bec5b5e64c25', 'fd0e9b1b-a84b-4c33-b87a-3eb0250fc6f7', 'teste', 'testando a mensagem', NULL, 0, true, '2025-12-29 04:16:28.657367+00', '2025-12-29 04:16:28.657367+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- NOTA: As tabelas visitas, webhook_logs, whatsapp_conversas e
-- whatsapp_mensagens contêm muitos registros. Para uma migração
-- completa desses dados, recomenda-se usar pg_dump diretamente
-- no banco de dados Supabase.
--
-- Os dados de alerta_envios e visitas foram omitidos por volume
-- mas a estrutura está completa acima.
-- ============================================================

-- ============================================================
-- 11. REALTIME (se necessário)
-- ============================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.reclamacoes;

-- ============================================================
-- FIM DO DUMP
-- ============================================================
