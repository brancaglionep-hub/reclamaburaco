import { useState } from "react";
import { ArrowRight, MapPin, Shield, Clock, Phone } from "lucide-react";
import heroImage from "@/assets/hero-street.png";
import ComplaintForm from "@/components/ComplaintForm";

const Index = () => {
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return <ComplaintForm onClose={() => setShowForm(false)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-3 px-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            <span className="font-semibold text-sm">Biguaçu - SC</span>
          </div>
          <a href="tel:4833463000" className="flex items-center gap-1 text-sm opacity-90 hover:opacity-100">
            <Phone className="w-4 h-4" />
            (48) 3346-3000
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 leading-tight">
            Prefeitura de Biguaçu
          </h1>
          <p className="text-lg text-primary font-semibold">
            Reclamações de Ruas
          </p>
        </div>

        {/* Hero Image */}
        <div className="rounded-3xl overflow-hidden mb-8 shadow-elevated animate-slide-up">
          <img 
            src={heroImage} 
            alt="Ilustração de manutenção de ruas - trabalhadores reparando buraco no asfalto" 
            className="w-full h-auto"
          />
        </div>

        {/* Main Message */}
        <div className="text-center mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <p className="text-lg text-foreground mb-2">
            Encontrou um problema na sua rua?
          </p>
          <p className="text-muted-foreground">
            Avise a Prefeitura de forma rápida e fácil.
          </p>
        </div>

        {/* CTA Button */}
        <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <button
            onClick={() => setShowForm(true)}
            className="btn-hero w-full flex items-center justify-center gap-3"
          >
            Informar problema na rua
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mt-10 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Rápido e fácil</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-2">
              <MapPin className="w-6 h-6 text-secondary" />
            </div>
            <p className="text-xs text-muted-foreground">Com localização</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Dados protegidos</p>
          </div>
        </div>

        {/* Types of Problems */}
        <div className="mt-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <h2 className="text-lg font-semibold text-center mb-4 text-foreground">
            Tipos de problemas que você pode informar:
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {["Buracos", "Rua danificada", "Alagamento", "Desnível", "Tráfego difícil"].map((item) => (
              <span 
                key={item}
                className="px-3 py-1.5 bg-muted text-muted-foreground text-sm rounded-full"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-muted py-6 mt-12">
        <div className="max-w-lg mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Prefeitura Municipal de Biguaçu
          </p>
          <p className="text-xs text-muted-foreground">
            Seus dados são protegidos conforme a LGPD.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
