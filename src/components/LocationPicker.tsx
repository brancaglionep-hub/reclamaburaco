import { MapPin, Loader2 } from "lucide-react";
import { useState } from "react";

interface LocationPickerProps {
  bairro: string;
  rua: string;
  numero: string;
  referencia: string;
  onBairroChange: (value: string) => void;
  onRuaChange: (value: string) => void;
  onNumeroChange: (value: string) => void;
  onReferenciaChange: (value: string) => void;
  onLocationCapture: (coords: { lat: number; lng: number }) => void;
}

const bairros = [
  "Centro",
  "Fundos",
  "Jardim Janaína",
  "Vendaval",
  "Prado",
  "Serraria",
  "Jardim Carandaí",
  "Bom Viver",
  "Bela Vista",
  "Rio Caveiras",
  "Três Riachos",
  "Guaporanga",
  "Sorocaba do Sul",
  "Tijuquinhas",
  "Praia de São Miguel",
  "Outro"
];

const LocationPicker = ({
  bairro,
  rua,
  numero,
  referencia,
  onBairroChange,
  onRuaChange,
  onNumeroChange,
  onReferenciaChange,
  onLocationCapture
}: LocationPickerProps) => {
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Seu navegador não suporta localização.");
      return;
    }

    setIsLoadingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationCapture({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLoadingLocation(false);
      },
      (error) => {
        setLocationError("Não foi possível obter sua localização.");
        setIsLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleGetLocation}
        disabled={isLoadingLocation}
        className="w-full card-problem flex items-center justify-center gap-3 min-h-[70px]"
      >
        {isLoadingLocation ? (
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        ) : (
          <MapPin className="w-6 h-6 text-primary" />
        )}
        <span className="font-medium">
          {isLoadingLocation ? "Obtendo localização..." : "Usar minha localização"}
        </span>
      </button>

      {locationError && (
        <p className="text-destructive text-sm text-center">{locationError}</p>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Bairro *</label>
          <select
            value={bairro}
            onChange={(e) => onBairroChange(e.target.value)}
            className="input-large"
            required
          >
            <option value="">Selecione o bairro</option>
            {bairros.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Nome da Rua *</label>
          <input
            type="text"
            value={rua}
            onChange={(e) => onRuaChange(e.target.value)}
            placeholder="Ex: Rua das Flores"
            className="input-large"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Número aproximado (opcional)</label>
          <input
            type="text"
            value={numero}
            onChange={(e) => onNumeroChange(e.target.value)}
            placeholder="Ex: próximo ao 150"
            className="input-large"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Ponto de referência (opcional)</label>
          <input
            type="text"
            value={referencia}
            onChange={(e) => onReferenciaChange(e.target.value)}
            placeholder="Ex: em frente ao mercado"
            className="input-large"
          />
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
