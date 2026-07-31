interface Props {
  visible: boolean;
}

export default function SplashScreen({ visible }: Props) {
  return (
    <div
      id="app-splash"
      className={`absolute inset-0 z-[70] flex items-center justify-center bg-white transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/mascot/splash.png"
        alt="청패 로고"
        draggable={false}
        className="w-56 h-auto object-contain select-none animate-fade-in"
      />
    </div>
  );
}
