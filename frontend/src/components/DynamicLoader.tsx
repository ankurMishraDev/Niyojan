import { Panel } from "@/components/ui";

export function DynamicLoader({
  currentStage,
  stages,
  label = "Processing...",
}: {
  currentStage?: string;
  stages: string[];
  label?: string;
}) {
  const currentIndex = currentStage
    ? stages.findIndex((s) => s.toLowerCase() === currentStage.toLowerCase())
    : 0;
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <Panel className="flex flex-col items-center justify-center p-8 sm:p-12 space-y-12 animate-in fade-in zoom-in duration-500 shadow-card-medium border-hairline-strong">
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Outer spinner */}
        <div className="absolute inset-0 rounded-full border-4 border-hairline border-t-primary animate-spin" style={{ animationDuration: '3s' }} />
        {/* Inner spinner */}
        <div className="absolute inset-2 rounded-full border-4 border-hairline border-b-primary opacity-70 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
        {/* Center pulsing core */}
        <div className="w-10 h-10 rounded-full bg-primary/20 animate-pulse flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-primary" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{label}</h3>
        <p className="text-sm text-body">Please wait while we process the data through our AI pipeline.</p>
      </div>
      
      <div className="w-full max-w-md space-y-6 pb-6">
        <div className="flex justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-hairline -translate-y-1/2 z-0 rounded-full" />
          <div 
            className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 z-0 transition-all duration-700 ease-out rounded-full"
            style={{ width: `${stages.length > 1 ? (activeIndex / (stages.length - 1)) * 100 : 100}%` }}
          />
          
          {stages.map((stage, i) => (
            <div key={stage} className="relative z-10 flex flex-col items-center">
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500
                  ${i < activeIndex ? 'bg-primary text-on-primary scale-110 shadow-sm' : 
                    i === activeIndex ? 'bg-primary text-on-primary ring-4 ring-primary/20 scale-125' : 
                    'bg-canvas border-2 border-hairline text-mute'}`}
              >
                {i < activeIndex ? '✓' : i + 1}
              </div>
              <span className={`text-[10px] sm:text-xs font-medium absolute -bottom-6 whitespace-nowrap transition-colors duration-500
                ${i <= activeIndex ? 'text-ink' : 'text-mute'}`}>
                {stage}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Skeleton Template Rendering */}
      <div className="w-full max-w-lg mt-8 pt-8 border-t border-hairline space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-md bg-canvas-soft-2 animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-canvas-soft-2 rounded w-1/3 animate-pulse" />
            <div className="h-3 bg-canvas-soft-2 rounded w-1/4 animate-pulse" />
          </div>
        </div>
        <div className="space-y-3 pt-4">
          <div className="h-10 bg-canvas-soft-2 rounded w-full animate-pulse" />
          <div className="h-10 bg-canvas-soft-2 rounded w-full animate-pulse" />
          <div className="h-10 bg-canvas-soft-2 rounded w-full animate-pulse" />
        </div>
      </div>
    </Panel>
  );
}
