import { useState } from "react";
import { ArrowLeft, ArrowRight, Send, CheckCircle2, Pencil } from "lucide-react";
import StepIndicator from "./StepIndicator";
import LocationPicker from "./LocationPicker";
import ProblemTypeSelector from "./ProblemTypeSelector";
import MediaUpload from "./MediaUpload";

interface FormData {
  nome: string;
  email: string;
  telefone: string;
  bairro: string;
  rua: string;
  numero: string;
  referencia: string;
  tipoProblema: string;
  outroProblema: string;
  descricao: string;
  fotos: File[];
  videos: File[];
  localizacao: { lat: number; lng: number } | null;
}

const stepLabels = ["Dados", "Local", "Problema", "Detalhes", "Mídia", "Enviar"];

const problemLabels: Record<string, string> = {
  buraco: "Buraco na rua",
  danificada: "Rua danificada",
  alagada: "Rua alagada",
  desnivel: "Desnível na pista",
  dificil: "Rua difícil de trafegar",
  outro: "Outro problema"
};

interface ComplaintFormProps {
  onClose: () => void;
}

const ComplaintForm = ({ onClose }: ComplaintFormProps) => {
  const [step, setStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    nome: "",
    email: "",
    telefone: "",
    bairro: "",
    rua: "",
    numero: "",
    referencia: "",
    tipoProblema: "",
    outroProblema: "",
    descricao: "",
    fotos: [],
    videos: [],
    localizacao: null
  });

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canAdvance = () => {
    switch (step) {
      case 1:
        return formData.nome.trim() !== "" && formData.email.trim() !== "";
      case 2:
        return formData.bairro !== "" && formData.rua.trim() !== "";
      case 3:
        return formData.tipoProblema !== "";
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (step < 6 && canAdvance()) {
      setStep(step + 1);
    }
  };

  const goToStep = (targetStep: number) => {
    if (targetStep >= 1 && targetStep <= 6) {
      setStep(targetStep);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onClose();
    }
  };

  const handleSubmit = () => {
    console.log("Reclamação enviada:", formData);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-secondary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">
          Reclamação enviada com sucesso!
        </h2>
        <p className="text-muted-foreground mb-8 max-w-sm">
          A Prefeitura de Biguaçu irá analisar sua solicitação e tomar as providências necessárias.
        </p>
        <button onClick={onClose} className="btn-hero">
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={handleBack} className="p-2 -ml-2 text-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Nova Reclamação</h1>
          <div className="w-10" />
        </div>
        <StepIndicator currentStep={step} totalSteps={6} labels={stepLabels} onStepClick={goToStep} />
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-lg mx-auto animate-slide-up" key={step}>
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-foreground mb-2">Seus Dados</h2>
                <p className="text-muted-foreground text-sm">
                  Seus dados serão usados apenas para contato sobre essa solicitação.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Nome completo *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => updateField("nome", e.target.value)}
                  placeholder="Digite seu nome"
                  className="input-large"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">E-mail *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="seu@email.com"
                  className="input-large"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Telefone / WhatsApp (opcional)</label>
                <input
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => updateField("telefone", e.target.value)}
                  placeholder="(48) 99999-9999"
                  className="input-large"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-foreground mb-2">Local da Rua</h2>
                <p className="text-muted-foreground text-sm">
                  Informe onde está o problema.
                </p>
              </div>
              
              <LocationPicker
                bairro={formData.bairro}
                rua={formData.rua}
                numero={formData.numero}
                referencia={formData.referencia}
                onBairroChange={(v) => updateField("bairro", v)}
                onRuaChange={(v) => updateField("rua", v)}
                onNumeroChange={(v) => updateField("numero", v)}
                onReferenciaChange={(v) => updateField("referencia", v)}
                onLocationCapture={(coords) => updateField("localizacao", coords)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-foreground mb-2">Tipo de Problema</h2>
                <p className="text-muted-foreground text-sm">
                  Selecione o que melhor descreve o problema.
                </p>
              </div>
              
              <ProblemTypeSelector
                selected={formData.tipoProblema}
                onSelect={(id) => updateField("tipoProblema", id)}
              />

              {formData.tipoProblema === "outro" && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-medium mb-2">Descreva o problema</label>
                  <input
                    type="text"
                    value={formData.outroProblema}
                    onChange={(e) => updateField("outroProblema", e.target.value)}
                    placeholder="Qual é o problema?"
                    className="input-large"
                  />
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-foreground mb-2">Descrição</h2>
                <p className="text-muted-foreground text-sm">
                  Se quiser, descreva melhor o problema da rua.
                </p>
              </div>
              
              <textarea
                value={formData.descricao}
                onChange={(e) => updateField("descricao", e.target.value)}
                placeholder="Conte mais detalhes sobre o problema..."
                className="input-large min-h-[180px] resize-none"
                rows={6}
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-foreground mb-2">Fotos e Vídeos</h2>
              </div>
              
              <MediaUpload
                photos={formData.fotos}
                videos={formData.videos}
                onPhotosChange={(files) => updateField("fotos", files)}
                onVideosChange={(files) => updateField("videos", files)}
              />
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-foreground mb-2">Confirmar Envio</h2>
                <p className="text-muted-foreground text-sm">
                  Revise as informações. Toque em "Editar" para alterar.
                </p>
              </div>
              
              <div className="card-elevated space-y-4">
                {/* Dados do cidadão */}
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-muted-foreground text-sm">Cidadão:</span>
                    <p className="font-medium text-foreground">{formData.nome}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => goToStep(1)}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    aria-label="Editar dados"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                <div className="border-t border-border" />

                {/* Local */}
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-muted-foreground text-sm">Local:</span>
                    <p className="font-medium text-foreground">{formData.rua}</p>
                    <p className="text-sm text-muted-foreground">{formData.bairro}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => goToStep(2)}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    aria-label="Editar local"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                <div className="border-t border-border" />

                {/* Problema */}
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-muted-foreground text-sm">Problema:</span>
                    <p className="font-medium text-foreground">
                      {formData.tipoProblema === "outro" 
                        ? formData.outroProblema || "Outro problema"
                        : problemLabels[formData.tipoProblema]}
                    </p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => goToStep(3)}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    aria-label="Editar problema"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                {formData.descricao && (
                  <>
                    <div className="border-t border-border" />
                    <div className="flex justify-between items-start">
                      <div className="flex-1 mr-2">
                        <span className="text-muted-foreground text-sm">Descrição:</span>
                        <p className="text-sm text-foreground">{formData.descricao}</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => goToStep(4)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        aria-label="Editar descrição"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}

                {(formData.fotos.length > 0 || formData.videos.length > 0) && (
                  <>
                    <div className="border-t border-border" />
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-muted-foreground text-sm">Mídia:</span>
                        <p className="font-medium text-foreground">
                          {formData.fotos.length > 0 && `${formData.fotos.length} foto(s)`}
                          {formData.fotos.length > 0 && formData.videos.length > 0 && ", "}
                          {formData.videos.length > 0 && `${formData.videos.length} vídeo(s)`}
                        </p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => goToStep(5)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        aria-label="Editar mídia"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border p-4 sticky bottom-0">
        <div className="max-w-lg mx-auto">
          {step < 6 ? (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              className="btn-hero w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuar
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="btn-hero w-full flex items-center justify-center gap-2"
              style={{ background: "var(--gradient-success)" }}
            >
              <Send className="w-5 h-5" />
              Enviar Reclamação
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default ComplaintForm;
