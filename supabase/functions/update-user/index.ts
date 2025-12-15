import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the requesting user is a super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if requesting user is super_admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'super_admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Apenas super admins podem editar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { user_id, email, password, nome, prefeitura_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'ID do usuário é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Updating user:', user_id)

    // Update auth user if email or password provided
    const authUpdates: any = {}
    if (email) authUpdates.email = email
    if (password) authUpdates.password = password

    if (Object.keys(authUpdates).length > 0) {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdates)
      if (updateAuthError) {
        console.error('Error updating auth user:', updateAuthError)
        return new Response(
          JSON.stringify({ error: updateAuthError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.log('Auth user updated')
    }

    // Update profile if nome or email provided
    if (nome || email) {
      const profileUpdates: any = {}
      if (nome) profileUpdates.nome = nome
      if (email) profileUpdates.email = email

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user_id)

      if (profileError) {
        console.error('Error updating profile:', profileError)
      } else {
        console.log('Profile updated')
      }
    }

    // Update prefeitura_id if provided
    if (prefeitura_id) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ prefeitura_id })
        .eq('user_id', user_id)
        .eq('role', 'admin_prefeitura')

      if (roleError) {
        console.error('Error updating role:', roleError)
      } else {
        console.log('Role prefeitura updated')
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})