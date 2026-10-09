import Autoplay from "embla-carousel-autoplay";
import { Building2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "~/components/ui/carousel";

const landingSlides = [
  {
    src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80",
  },
  {
    src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80",
  },
  {
    src: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
  },
];

export function RegisterPage() {
  return (
    <div className="flex w-full h-screen bg-background">
      {/* Lado visual (landing) — solo en escritorio */}
      <div className="relative hidden h-full overflow-hidden lg:flex lg:w-1/2">
        <Carousel
          opts={{ loop: true }}
          plugins={[
            Autoplay({ delay: 5000, stopOnInteraction: false }),
          ]}
          className="h-full w-full"
        >
          <CarouselContent className="h-full">
            {landingSlides.map((slide, index) => (
              <CarouselItem key={index} className="h-full pl-0">
                <img
                  src={slide.src}
                  alt={`Gestiona tu negocio · Imagen ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Overlay oscuro para resaltar el texto */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

        {/* Propuesta de valor */}
        <div className="absolute bottom-10 left-10 right-10 max-w-md">
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/70">
            <span className="h-px w-8 bg-white/50" />
            Gestión comercial
          </p>
          <h2 className="text-2xl font-bold leading-tight text-white">
            Gestiona tu negocio como un profesional. Todo lo que necesitas en un
            solo lugar.
          </h2>
        </div>
      </div>

      {/* Lado de registro — móvil y escritorio */}
      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Gestión Comercial
            </span>
          </div>

          {/* Encabezado */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Crea tu cuenta
            </h1>
            <p className="text-muted-foreground">
              Comienza a gestionar tus ventas hoy mismo.
            </p>
          </div>

          {/* AQUÍ VA EL COMPONENTE DE REGISTRO DEL USUARIO */}
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              AQUÍ VA EL COMPONENTE DE REGISTRO DEL USUARIO
            </p>
            <Button className="w-full" size="lg">
              Completar registro
            </Button>
          </div>

          {/* Pie */}
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes una cuenta?{" "}
            <a
              href="#"
              onClick={(event) => event.preventDefault()}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Inicia sesión
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}