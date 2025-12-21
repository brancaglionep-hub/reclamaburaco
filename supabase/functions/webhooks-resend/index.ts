import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    [key: string]: unknown;
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Resend webhook received:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const event: ResendWebhookEvent = await req.json();
    
    console.log("Resend webhook event type:", event.type);
    console.log("Resend webhook data:", JSON.stringify(event.data, null, 2));

    // Handle different event types
    switch (event.type) {
      case "email.sent":
        console.log(`Email sent to: ${event.data.to?.join(", ")}`);
        break;
      
      case "email.delivered":
        console.log(`Email delivered to: ${event.data.to?.join(", ")}`);
        break;
      
      case "email.delivery_delayed":
        console.log(`Email delivery delayed for: ${event.data.to?.join(", ")}`);
        break;
      
      case "email.complained":
        console.log(`Email complaint from: ${event.data.to?.join(", ")}`);
        break;
      
      case "email.bounced":
        console.log(`Email bounced for: ${event.data.to?.join(", ")}`);
        // Aqui você pode adicionar lógica para marcar o email como inválido no banco
        break;
      
      case "email.opened":
        console.log(`Email opened by: ${event.data.to?.join(", ")}`);
        break;
      
      case "email.clicked":
        console.log(`Email link clicked by: ${event.data.to?.join(", ")}`);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true, type: event.type }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing Resend webhook:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
