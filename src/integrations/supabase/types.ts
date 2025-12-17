export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      avaliacoes: {
        Row: {
          avaliado_em: string | null
          comentario: string | null
          created_at: string
          estrelas: number
          id: string
          prefeitura_id: string
          reclamacao_id: string
          token: string
        }
        Insert: {
          avaliado_em?: string | null
          comentario?: string | null
          created_at?: string
          estrelas: number
          id?: string
          prefeitura_id: string
          reclamacao_id: string
          token?: string
        }
        Update: {
          avaliado_em?: string | null
          comentario?: string | null
          created_at?: string
          estrelas?: number
          id?: string
          prefeitura_id?: string
          reclamacao_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_reclamacao_id_fkey"
            columns: ["reclamacao_id"]
            isOneToOne: false
            referencedRelation: "reclamacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bairros: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          prefeitura_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          prefeitura_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          prefeitura_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bairros_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          global: boolean | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          prefeitura_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          global?: boolean | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          prefeitura_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          global?: boolean | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          prefeitura_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_status: {
        Row: {
          created_at: string | null
          id: string
          observacao: string | null
          reclamacao_id: string
          status_anterior:
            | Database["public"]["Enums"]["complaint_status"]
            | null
          status_novo: Database["public"]["Enums"]["complaint_status"]
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          reclamacao_id: string
          status_anterior?:
            | Database["public"]["Enums"]["complaint_status"]
            | null
          status_novo: Database["public"]["Enums"]["complaint_status"]
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          reclamacao_id?: string
          status_anterior?:
            | Database["public"]["Enums"]["complaint_status"]
            | null
          status_novo?: Database["public"]["Enums"]["complaint_status"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_status_reclamacao_id_fkey"
            columns: ["reclamacao_id"]
            isOneToOne: false
            referencedRelation: "reclamacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prefeituras: {
        Row: {
          ativo: boolean | null
          cidade: string
          cor_primaria: string | null
          cor_secundaria: string | null
          created_at: string | null
          email_contato: string | null
          estado: string
          id: string
          logo_url: string | null
          nome: string
          slug: string
          telefone_contato: string | null
          texto_institucional: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cidade: string
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string | null
          email_contato?: string | null
          estado?: string
          id?: string
          logo_url?: string | null
          nome: string
          slug: string
          telefone_contato?: string | null
          texto_institucional?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cidade?: string
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string | null
          email_contato?: string | null
          estado?: string
          id?: string
          logo_url?: string | null
          nome?: string
          slug?: string
          telefone_contato?: string | null
          texto_institucional?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string | null
          prefeitura_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          nome?: string | null
          prefeitura_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          prefeitura_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
        ]
      }
      reclamacoes: {
        Row: {
          bairro_id: string | null
          categoria_id: string | null
          created_at: string | null
          descricao: string
          email_cidadao: string
          fotos: string[] | null
          id: string
          localizacao: Json | null
          nome_cidadao: string
          numero: string | null
          prefeitura_id: string
          protocolo: string
          referencia: string | null
          resposta_prefeitura: string | null
          rua: string
          status: Database["public"]["Enums"]["complaint_status"] | null
          telefone_cidadao: string | null
          updated_at: string | null
          videos: string[] | null
        }
        Insert: {
          bairro_id?: string | null
          categoria_id?: string | null
          created_at?: string | null
          descricao: string
          email_cidadao: string
          fotos?: string[] | null
          id?: string
          localizacao?: Json | null
          nome_cidadao: string
          numero?: string | null
          prefeitura_id: string
          protocolo: string
          referencia?: string | null
          resposta_prefeitura?: string | null
          rua: string
          status?: Database["public"]["Enums"]["complaint_status"] | null
          telefone_cidadao?: string | null
          updated_at?: string | null
          videos?: string[] | null
        }
        Update: {
          bairro_id?: string | null
          categoria_id?: string | null
          created_at?: string | null
          descricao?: string
          email_cidadao?: string
          fotos?: string[] | null
          id?: string
          localizacao?: Json | null
          nome_cidadao?: string
          numero?: string | null
          prefeitura_id?: string
          protocolo?: string
          referencia?: string | null
          resposta_prefeitura?: string | null
          rua?: string
          status?: Database["public"]["Enums"]["complaint_status"] | null
          telefone_cidadao?: string | null
          updated_at?: string | null
          videos?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "reclamacoes_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reclamacoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reclamacoes_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          prefeitura_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          prefeitura_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          prefeitura_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          created_at: string | null
          id: string
          pagina: string
          prefeitura_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pagina: string
          prefeitura_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pagina?: string
          prefeitura_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitas_prefeitura_id_fkey"
            columns: ["prefeitura_id"]
            isOneToOne: false
            referencedRelation: "prefeituras"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buscar_avaliacao_por_token: {
        Args: { _token: string }
        Returns: {
          bairro_nome: string
          categoria_nome: string
          ja_avaliada: boolean
          prefeitura_nome: string
          protocolo: string
          rua: string
        }[]
      }
      consultar_historico_protocolo: {
        Args: { _prefeitura_id: string; _protocolo: string }
        Returns: {
          created_at: string
          id: string
          observacao: string
          status_anterior: string
          status_novo: string
        }[]
      }
      consultar_protocolo: {
        Args: { _prefeitura_id: string; _protocolo: string }
        Returns: {
          bairro_nome: string
          categoria_nome: string
          created_at: string
          id: string
          protocolo: string
          resposta_prefeitura: string
          rua: string
          status: Database["public"]["Enums"]["complaint_status"]
          updated_at: string
        }[]
      }
      criar_reclamacao_publica: {
        Args: {
          _bairro_id?: string
          _categoria_id?: string
          _descricao?: string
          _email_cidadao: string
          _fotos?: string[]
          _localizacao?: Json
          _nome_cidadao: string
          _numero?: string
          _prefeitura_id: string
          _referencia?: string
          _rua: string
          _telefone_cidadao?: string
          _videos?: string[]
        }
        Returns: {
          protocolo: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_prefeitura_admin: {
        Args: { _prefeitura_id: string; _user_id: string }
        Returns: boolean
      }
      submeter_avaliacao: {
        Args: { _comentario?: string; _estrelas: number; _token: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "admin_prefeitura" | "user"
      complaint_status: "recebida" | "em_andamento" | "resolvida" | "arquivada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin_prefeitura", "user"],
      complaint_status: ["recebida", "em_andamento", "resolvida", "arquivada"],
    },
  },
} as const
