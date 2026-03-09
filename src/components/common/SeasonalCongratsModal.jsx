import { useEffect, useState } from "react";

const ChristmasTree = () => {
  const ornaments = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    cx: 25 + Math.random() * 50,
    cy: 30 + Math.random() * 45,
    color: ["#FF0000", "#FFD700", "#FF6B6B", "#FFE66D"][i % 4],
  }));

  return (
    <div
      className="fixed bottom-12 right-12 z-50 animate-in fade-in slide-in-from-bottom-10 duration-700"
      style={{
        filter: "drop-shadow(0 20px 35px rgba(0, 0, 0, 0.25))",
      }}
    >
      <svg
        viewBox="0 0 100 120"
        className="w-72 h-72" // ⬅️ Increased size from w-40 h-40
        style={{ filter: "none" }}
      >
        {/* Tree trunk */}
        <rect x="40" y="70" width="20" height="25" fill="#8B4513" />

        {/* Tree layers */}
        <polygon points="50,10 25,45 75,45" fill="#1B5E20" />
        <polygon points="50,35 20,65 80,65" fill="#2E7D32" />
        <polygon points="50,55 15,85 85,85" fill="#1B5E20" />

        {/* Star on top */}
        <polygon
          points="50,0 55,15 70,15 58,25 63,40 50,30 37,40 42,25 30,15 45,15"
          fill="#FFD700"
          style={{
            animation: "spin 4s linear infinite",
            transformOrigin: "50px 0px",
          }}
        />

        {/* Ornaments */}
        {ornaments.map((ornament) => (
          <circle
            key={ornament.id}
            cx={ornament.cx}
            cy={ornament.cy}
            r="4" // ⬅️ Slightly larger ornaments
            fill={ornament.color}
            style={{
              animation: `twinkle 1.5s ease-in-out ${
                ornament.id * 0.1
              }s infinite`,
            }}
          />
        ))}
      </svg>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes twinkle {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

const Fireworks = ({ isActive }) => {
  const [fireworks, setFireworks] = useState([]);

  useEffect(() => {
    if (!isActive) return;

    const generateFireworks = () => {
      const newFireworks = [];
      for (let i = 0; i < 2; i++) {
        // Changed to 2 fireworks at a time
        const launchX = Math.random() * window.innerWidth;
        const launchY = window.innerHeight;
        const particles = Array.from({ length: 40 }, (_, j) => ({
          id: `${Date.now()}-${i}-${j}`,
          x: launchX,
          y: launchY,
          vx: 0,
          vy: -10 - Math.random() * 5, // Initial upward velocity
          phase: "launch",
          launchTime: Date.now(),
          explodeTime: Date.now() + 300 + Math.random() * 1000, // Wider range: 300-1300ms for varying heights (some higher, some lower)
          color: [
            "#FF1744",
            "#F50057",
            "#D500F9",
            "#651FFF",
            "#2979F3",
            "#00B0FF",
          ][Math.floor(Math.random() * 6)],
          startTime: Date.now(),
        }));
        newFireworks.push(...particles);
      }
      setFireworks((prev) => [...prev, ...newFireworks]);
    };

    const interval = setInterval(generateFireworks, 600);
    generateFireworks();

    const animationFrame = setInterval(() => {
      setFireworks((prev) => {
        const now = Date.now();
        return prev
          .map((p) => {
            if (p.phase === "launch") {
              if (now > p.explodeTime) {
                p.phase = "explode";
                p.vx = (Math.random() - 0.5) * 8;
                p.vy = (Math.random() - 0.5) * 8;
              } else {
                // Apply gravity during launch (pulls down, slowing ascent)
                p.vy += 0.1;
              }
            } else {
              // Apply gravity during explosion
              p.vy += 0.1;
            }
            p.x += p.vx;
            p.y += p.vy;
            return p;
          })
          .filter((p) => now - p.startTime < 3000); // Longer duration for full effect
      });
    }, 30);

    return () => {
      clearInterval(interval);
      clearInterval(animationFrame);
    };
  }, [isActive]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
      {fireworks.map((particle) => {
        const elapsed = Date.now() - particle.startTime;
        const progress = Math.min(elapsed / 3000, 1);

        return (
          <div
            key={particle.id}
            className="absolute w-2 h-2 rounded-full"
            style={{
              backgroundColor: particle.color,
              left: particle.x,
              top: particle.y,
              opacity: 1 - progress,
              boxShadow: `0 0 6px ${particle.color}`,
            }}
          />
        );
      })}
    </div>
  );
};

const SeasonalCongratsModal = ({ isOpen, onClose }) => {
  const [season, setSeason] = useState("default");
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    const month = new Date().getMonth();

    if (month === 10) setSeason("halloween");
    else if (month === 11) setSeason("christmas");
    else if (month === 0) setSeason("newyear");
    else setSeason("default");

    const particles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
    }));

    setConfetti(particles);
  }, []);

  const seasonConfig = {
    halloween: {
      title: "Great Job!",
      subtitle: "You've completed the tutorial",
      bgColor: "from-amber-950 via-orange-800 to-purple-900",
      accentColor: "bg-orange-500",
      textColor: "text-white",
      buttonColor:
        "from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700",
      icon: (
        <svg className="w-24 h-24" viewBox="0 0 100 100" fill="none">
          <circle
            cx="50"
            cy="45"
            r="25"
            className="text-orange-500"
            fill="currentColor"
          />
          <circle cx="40" cy="35" r="4" fill="black" />
          <circle cx="60" cy="35" r="4" fill="black" />
          <path d="M 50 50 Q 45 55 40 55" stroke="black" strokeWidth="2" />
        </svg>
      ),
      confettiColor: "bg-orange-500",
    },

    christmas: {
      title: "Merry Christmas!",
      subtitle: "You've completed the tutorial",
      bgColor: "from-red-700 via-red-600 to-emerald-700",
      accentColor: "bg-red-500",
      textColor: "text-white",
      buttonColor:
        "from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700",
      icon: (
        <svg className="w-24 h-24" viewBox="0 0 100 100" fill="none">
          <path
            d="M50 10 L60 35 L85 35 L65 50 L75 75 L50 60 L25 75 L35 50 L15 35 L40 35 Z"
            className="text-red-400"
            fill="currentColor"
          />
          <circle
            cx="50"
            cy="65"
            r="12"
            className="text-emerald-300"
            fill="currentColor"
          />
          <circle
            cx="35"
            cy="75"
            r="8"
            className="text-emerald-300"
            fill="currentColor"
          />
          <circle
            cx="65"
            cy="75"
            r="8"
            className="text-emerald-300"
            fill="currentColor"
          />
        </svg>
      ),
      confettiColor: "bg-red-500",
    },

    newyear: {
      title: "Happy New Year!",
      subtitle: "You've completed the tutorial",
      bgColor: "from-slate-900 via-blue-800 to-cyan-700",
      accentColor: "bg-blue-500",
      textColor: "text-white",
      buttonColor:
        "from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700",
      icon: (
        <svg className="w-24 h-24" viewBox="0 0 100 100" fill="none">
          {/* YEAR */}
          <text
            x="50"
            y="65"
            fontSize="22"
            fontWeight="700"
            textAnchor="middle"
            fill="#60A5FA"
          >
            2025
          </text>

          <path
            d="
      M42 38 
      L50 22 
      L58 38 

      M50 22 
      L50 52
    "
            stroke="#06B6D4"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      ),
      confettiColor: "bg-blue-500",
    },

    default: {
      title: "Congratulations!",
      subtitle: "You've completed the tutorial",
      bgColor: "from-indigo-500 via-purple-600 to-pink-500",
      accentColor: "bg-indigo-500",
      textColor: "text-white",
      buttonColor:
        "from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800",
      icon: (
        <svg className="w-24 h-24" viewBox="0 0 100 100" fill="none">
          <circle
            cx="50"
            cy="50"
            r="35"
            stroke="currentColor"
            strokeWidth="3"
            className="text-indigo-400"
          />
          <path
            d="M35 50 L45 60 L65 40"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-indigo-400"
          />
          {/* Add a subtle glow effect */}
          <circle
            cx="50"
            cy="50"
            r="35"
            fill="none"
            stroke="rgba(99, 102, 241, 0.3)"
            strokeWidth="6"
            className="animate-pulse"
          />
        </svg>
      ),
      confettiColor: "bg-indigo-500",
    },
  };

  const config = seasonConfig[season];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          {/* Confetti */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {confetti.map((item) => (
              <div
                key={item.id}
                className={`absolute w-3 h-3 ${config.confettiColor} rounded-full shadow-lg animate-pulse`}
                style={{
                  left: `${item.left}%`,
                  top: 0,
                  animation: `fall ${3}s ease-in ${item.delay}s forwards`,
                }}
              />
            ))}
          </div>
          {season === "newyear" && <Fireworks isActive={isOpen} />}

          {season === "christmas" && isOpen && <ChristmasTree />}

          {/* Card-like structure */}
          <div
            className="relative bg-white rounded-3xl shadow-2xl overflow-hidden max-w-md w-full border border-gray-200 animate-in zoom-in-95 duration-500"
            onClick={(e) => e.stopPropagation()}
            style={{
              filter: "drop-shadow(0 25px 50px rgba(0, 0, 0, 0.3))",
            }}
          >
            {/* Header with seasonal gradient */}
            <div
              className={`bg-gradient-to-br ${config.bgColor} p-8 text-center relative overflow-hidden`}
            >
              {/* Subtle pattern overlay for texture */}
              <div className="absolute inset-0 bg-white/10 opacity-20"></div>
              <div className="relative z-10 animate-bounce">{config.icon}</div>
            </div>

            {/* Body */}
            <div className="p-8 text-center space-y-6 bg-gradient-to-b from-gray-50 to-white">
              {/* Title + Subtitle */}
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-800 text-balance leading-tight">
                  {config.title}
                </h2>

                <p className="text-base md:text-lg text-gray-600 font-light tracking-wide leading-relaxed">
                  {config.subtitle}
                </p>
              </div>

              {/* Accent line */}
              <div
                className={`h-2 w-24 rounded-full ${config.accentColor} mx-auto shadow-sm`}
              />

              <div className="flex flex-col gap-4 w-full pt-6">
                <button
                  onClick={onClose}
                  className={`bg-gradient-to-r ${config.buttonColor} py-4 px-8 rounded-2xl text-white font-semibold w-full border border-transparent transition-all duration-200 active:scale-95 shadow-lg hover:shadow-xl`}
                >
                  Close
                </button>
              </div>

              {/* Animated stars */}
              <div className="flex justify-center gap-4 pt-6">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="text-yellow-400 animate-pulse drop-shadow-sm"
                    style={{ animationDelay: `${i * 0.3}s` }}
                  >
                    <svg
                      className="w-8 h-8"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes fall {
              to {
                transform: translateY(100vh) rotateZ(360deg);
                opacity: 0;
              }
            }

            @keyframes bounce {
              0%,
              100% {
                transform: translateY(0);
              }
              50% {
                transform: translateY(-10px);
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
};

export default SeasonalCongratsModal;
