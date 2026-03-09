import { motion } from "framer-motion";
import { FaArrowRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const AnimatedCard = ({ item, index, IconComponent, onClick }) => {
  const navigate = useNavigate();

  const handleCardClick = (route) => {
    if (onClick) {
      onClick(); // use custom action if provided
    } else {
      navigate(route);
    }
  };
  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: i * 0.08,
        duration: 0.7,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    }),
  };
  return (
    <motion.div
      key={item.route}
      custom={index}
      variants={cardVariants}
      whileHover={{
        y: -8,
        scale: 1.02,
        transition: { duration: 0.3, ease: "easeOut" },
      }}
      whileTap={{ scale: 0.98 }}
      onClick={() => handleCardClick(item.route)}
      className="group relative cursor-pointer overflow-hidden rounded-3xl bg-white/80 backdrop-blur-sm p-8 shadow-sm ring-1 ring-gray-200/50 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 hover:ring-blue-300/30"
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 transition-all duration-500 group-hover:opacity-[0.03]`}
      />

      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm">
          {item.category}
        </span>
      </div>

      <div className="relative">
        <div
          className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl ${item.bgColor} backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:rotate-3`}
        >
          <IconComponent
            className={`h-8 w-8 ${item.iconColor} transition-transform duration-300 group-hover:scale-110`}
          />
        </div>

        <h3 className="mt-6 text-xl font-bold text-gray-900 group-hover:text-gray-700 transition-colors duration-300">
          {item.title}
        </h3>

        <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-2">
          {item.description}
        </p>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center text-sm font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
            <span>Explore</span>
            <FaArrowRight className="ml-2 h-3 w-3 transition-transform group-hover:translate-x-1" />
          </div>

          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-50 to-violet-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
            <FaArrowRight className="h-3 w-3 text-blue-600" />
          </div>
        </div>
      </div>

      <div
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          padding: "1px",
          background:
            "linear-gradient(135deg, transparent, rgba(59, 130, 246, 0.1), transparent)",
        }}
      />
    </motion.div>
  );
};

export default AnimatedCard;
