import { Camera, Video, X, ImagePlus } from "lucide-react";
import { useRef, useState } from "react";

interface MediaUploadProps {
  photos: File[];
  videos: File[];
  onPhotosChange: (files: File[]) => void;
  onVideosChange: (files: File[]) => void;
}

const MediaUpload = ({ photos, videos, onPhotosChange, onVideosChange }: MediaUploadProps) => {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      onPhotosChange([...photos, ...newFiles]);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      onVideosChange([...videos, ...newFiles]);
    }
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const removeVideo = (index: number) => {
    onVideosChange(videos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-center">
        Fotos e vídeos ajudam a Prefeitura a resolver mais rápido.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="card-problem flex flex-col items-center justify-center gap-3 min-h-[120px]"
        >
          <Camera className="w-10 h-10 text-primary" />
          <span className="text-sm font-medium">Tirar Foto</span>
        </button>

        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="card-problem flex flex-col items-center justify-center gap-3 min-h-[120px]"
        >
          <ImagePlus className="w-10 h-10 text-primary" />
          <span className="text-sm font-medium">Galeria</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => videoInputRef.current?.click()}
        className="card-problem w-full flex flex-col items-center justify-center gap-3 min-h-[100px]"
      >
        <Video className="w-10 h-10 text-primary" />
        <span className="text-sm font-medium">Adicionar Vídeo</span>
      </button>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoUpload}
        className="hidden"
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoUpload}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoUpload}
        className="hidden"
      />

      {(photos.length > 0 || videos.length > 0) && (
        <div className="space-y-4">
          <h4 className="font-medium text-foreground">Arquivos selecionados:</h4>
          
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {videos.length > 0 && (
            <div className="space-y-2">
              {videos.map((video, index) => (
                <div key={index} className="flex items-center justify-between bg-muted rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Video className="w-5 h-5 text-primary" />
                    <span className="text-sm truncate max-w-[180px]">{video.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVideo(index)}
                    className="w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaUpload;
