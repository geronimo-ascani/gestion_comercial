import { useEffect, useRef, useState, type ReactNode } from "react";
import Autoplay from "embla-carousel-autoplay";
import { Building2 } from "lucide-react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "~/components/ui/carousel";
import {
  MiniScreen,
  type SystemVariant,
} from "./auth-system-preview";

const photos = {
  cargas:
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80",
  oficina:
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80",
  deposito:
    "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1600&q=80",
  local:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
  despacho:
    "https://images.unsplash.com/photo-1524522173746-f628baad3644?auto=format&fit=crop&w=1600&q=80",
};

interface Slide {
  id: string;
  src?: string;
  mockup?: SystemVariant;
  eyebrow: string;
  text: string;
}

const slides: Slide[] = [
  {
    id: "cargas",
    src: photos.cargas,
    mockup: "productos",
    eyebrow: "Stock y logística",
    text: "Cargá y controlá el inventario en tiempo real, con alertas de stock crítico.",
  },
  {
    id: "oficina",
    src: photos.oficina,
    mockup: "analiticas",
    eyebrow: "Tu equipo",
    text: "Monitoreá el negocio con tu equipo y tomá decisiones con datos reales.",
  },
  {
    id: "deposito",
    src: photos.deposito,
    mockup: "productos",
    eyebrow: "Depósito ordenado",
    text: "Precios, márgenes y niveles de stock siempre actualizados y sincronizados.",
  },
  {
    id: "local",
    src: photos.local,
    mockup: "dashboard",
    eyebrow: "Tu punto de venta",
    text: "Seguí las ventas del día a día y detectá tus horarios de mayor demanda.",
  },
  {
    id: "despacho",
    src: photos.despacho,
    mockup: "dashboard",
    eyebrow: "Pedidos y despacho",
    text: "Organizá, prepará y entregá cada pedido sin fricciones.",
  },
];

function useActiveSlide(setApi: (api: CarouselApi) => void) {
  const [api, setApiState] = useState<CarouselApi | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function register(instance: CarouselApi) {
    setApiState(instance);
    setApi(instance);
  }

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setActiveIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  return { setApi: register, activeIndex };
}

function BottomMockup({ variant }: { variant: SystemVariant }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.75);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setScale(Math.min(element.clientWidth / 540, 1));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex justify-center">
      <MiniScreen variant={variant} scale={scale} className="relative" />
    </div>
  );
}

interface AuthSplitLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthSplitLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthSplitLayoutProps) {
  const { setApi, activeIndex } = useActiveSlide(() => undefined);
  const active = slides[activeIndex];

  return (
    <div className="flex w-full h-screen bg-background">
      {/* Lado visual (landing) — solo en escritorio */}
      <div className="relative hidden h-full overflow-hidden lg:flex lg:w-1/2">
        <Carousel
          setApi={setApi}
          opts={{ loop: true }}
          plugins={[Autoplay({ delay: 5000, stopOnInteraction: false })]}
          className="h-full w-full"
        >
          <CarouselContent className="h-full">
            {slides.map((slide) => (
              <CarouselItem key={slide.id} className="h-full pl-0">
                <div className="relative h-full w-full">
                  <img
                    src={slide.src}
                    alt={slide.eyebrow}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/10 to-black/55" />
                  {slide.mockup && (
                    <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl bg-black/25 p-2.5 shadow-2xl backdrop-blur-md">
                      <BottomMockup variant={slide.mockup} />
                    </div>
                  )}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Overlay oscuro para resaltar el texto */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/80 via-black/20 to-black/5" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

        {/* Propuesta de valor (sincronizada con el slide activo) */}
        <div className="pointer-events-none absolute top-14 left-10 right-10 max-w-md">
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/70">
            <span className="h-px w-8 bg-white/50" />
            {active.eyebrow}
          </p>
          <h2
            key={active.id}
            className="text-2xl font-bold leading-tight text-white"
          >
            {active.text}
          </h2>
        </div>
      </div>

      {/* Lado del formulario — móvil y escritorio */}
      <div className="flex w-full overflow-y-auto bg-background p-8 lg:w-1/2">
        <div className="m-auto w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
           
          </div>

          {/* Encabezado */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>

          {children}

          {footer}
        </div>
      </div>
    </div>
  );
}