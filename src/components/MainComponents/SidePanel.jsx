import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import { motion } from "framer-motion";

// icons
import {
  AiOutlineHome,
  AiOutlineDashboard,
  AiOutlineCloudUpload,
  AiOutlineDatabase,
  AiOutlineBarChart,
} from "react-icons/ai";
import {
  FaRegMoneyBillAlt,
  FaBook,
  FaUserCheck,
  FaUserEdit,
  FaUserCog,
} from "react-icons/fa";
import {
  IoSettingsOutline,
  IoChevronDown,
  IoLogOutOutline,
} from "react-icons/io5";
import { useCustomMutation } from "../../hooks/useCustomMutations";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";
import useZustandMobile from "../../context/useZustandMobile";

const SidePanel = () => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  /*____________________________CONTEXTS__________________________________*/
  const { isAuthenticated, toggleAuthentication } = useZustandLoginCred();
  const { isMobile, toggleIsMobile } = useZustandMobile();
  const [isLogoutYesNoModalOpen, setLogoutYesNoModalOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const {
    data: logoutData,
    isLoading,
    mutate,
  } = useCustomMutation(
    localStorage.getItem("apiendpoint") + import.meta.env.VITE_LOGOUT_ENDPOINT,
    "POST"
  );

  const handleLogout = () => {
    const confirmed = window.confirm("Continue logout?");
    if (confirmed) {
      const refreshToken = localStorage.getItem("refresh_token");
      mutate({ token: refreshToken });
    }
  };

  useEffect(() => {
    if (logoutData?.message === "logout success") {
      alert("Logged out successfully");
      toggleAuthentication();
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("apiendpoint");
      localStorage.removeItem("companycode");
      sessionStorage.removeItem("mainRedirectDone");
      sessionStorage.removeItem("prRedirectDone");
      navigate("/");
    }
  }, [logoutData]);

  const navigate = useNavigate();
  const { selectedMenu, setSelectedMenu, toggleIsDesktopSideMenu } =
    useZustandSideMenu();
  const [hovered, setHovered] = useState("");
  const { roles, firstName, profilePic, userId, email } = useZustandLoginCred();
  const companycode = localStorage.getItem("companycode");

  // ⬇️ click‐outside ref and handler
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (isMobile) {
          toggleIsMobile(); // handle mobile menu close
        } else {
          toggleIsDesktopSideMenu(); // handle desktop menu close
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile, toggleIsMobile, toggleIsDesktopSideMenu]);

  const handleClick = (key, path) => {
    setSelectedMenu(key);
    navigate(path);
    if (isMobile) {
      toggleIsMobile(); // handle mobile menu close
    } else {
      toggleIsDesktopSideMenu(); // handle desktop menu close
    }
  };

  const handleFilterImageURL = (imagePath) => {
    const parts = imagePath.split("images/employees/");
    const file = parts[1] || "";
    return (
      localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_IMAGE_URLS +
      file
    );
  };

  return (
    <>
      {isLogoutYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Continue logout?"
          setYesNoModalOpen={""}
          triggerYesNoEvent={() => alert("Hey")}
        />
      )}
      <motion.div
        ref={panelRef}
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 h-screen w-64 sm:w-72 bg-gradient-to-b from-darkerPrimary via-darkPrimary to-medPrimary backdrop-blur-xl border-r border-slate-700/50 flex flex-col z-50 lg:block shadow-2xl shadow-slate-900/20"
      >
        {/* Loading Indicator */}
        {isLoading && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            className="w-full h-0.5 bg-gradient-to-r from-colorBrand via-colorBrandSecondary to-colorBrandTertiary origin-left"
          />
        )}

        {/* Redesigned Header with Conditional Icons */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative"
        >
          {/* Main Header */}
          <div className="px-3 py-3 bg-gradient-to-r from-softPrimary to-darkPrimary backdrop-blur-sm border-b border-darkerPrimary/50">
            <div className="flex items-center justify-between">
              {/* Profile Section */}
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  <motion.img
                    whileHover={{ scale: 1.05 }}
                    src={handleFilterImageURL(profilePic) || "/placeholder.svg"}
                    alt="Avatar"
                    onError={(e) =>
                      (e.currentTarget.src = "/default-avatar.png")
                    }
                    className="w-8 h-8 rounded-full object-cover border border-slate-500/50 shadow-md ring-1 ring-blue-500/20 transition-all duration-300"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{
                      repeat: Number.POSITIVE_INFINITY,
                      duration: 2,
                    }}
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-slate-800 shadow-sm"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-white font-medium text-sm truncate"
                  >
                    {firstName}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-xs text-green-400 flex items-center gap-1"
                  >
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{
                        repeat: Number.POSITIVE_INFINITY,
                        duration: 1.5,
                      }}
                      className="w-1.5 h-1.5 bg-green-400 rounded-full"
                    />
                    <span className="font-medium">Online</span>
                  </motion.div>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {!showProfileDropdown && (
                  <>
                    {/* Settings Button - Only show when dropdown is closed */}
                    {roles[0]?.some((r) => r.rolename === "/settings") && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleClick("Settings", "/settings")}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200 group"
                        title="Settings"
                      >
                        <IoSettingsOutline size={16} />
                      </motion.button>
                    )}

                    {isAuthenticated && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleLogout}
                        disabled={isLoading}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 group disabled:opacity-50"
                        title="Logout"
                      >
                        {isLoading ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Number.POSITIVE_INFINITY,
                              ease: "linear",
                            }}
                          >
                            <IoLogOutOutline size={16} />
                          </motion.div>
                        ) : (
                          <IoLogOutOutline size={16} />
                        )}
                      </motion.button>
                    )}
                  </>
                )}

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200 group"
                  title="Profile Menu"
                >
                  <motion.div
                    animate={{ rotate: showProfileDropdown ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <IoChevronDown size={14} />
                  </motion.div>
                </motion.button>
              </div>
            </div>
          </div>

          {showProfileDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-full left-0 right-0 bg-gradient-to-b from-darkPrimary to-medPrimary border-b border-slate-700/50 shadow-lg z-10"
            >
              <div className="px-3 py-3 space-y-3">
                {/* Account Info Section */}
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-2">
                    Account Information
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-slate-300 truncate">
                      <span className="text-slate-500">ID:</span> {userId}
                    </div>
                    <div className="text-xs text-slate-300 truncate">
                      <span className="text-slate-500">Company Code:</span>{" "}
                      {companycode}
                    </div>
                    <div className="text-xs text-slate-300 truncate">
                      <span className="text-slate-500">Email:</span> {email}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/30 space-y-1">
                  <div className="text-xs text-slate-400 font-medium mb-2">
                    Actions
                  </div>

                  {/* Settings Button in Dropdown */}
                  {roles[0]?.some((r) => r.rolename === "/settings") && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowProfileDropdown(false);
                        handleClick("Settings", "/settings");
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-md transition-all duration-200"
                    >
                      <IoSettingsOutline size={14} />
                      Settings
                    </motion.button>
                  )}

                  {isAuthenticated && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowProfileDropdown(false);
                        handleLogout();
                      }}
                      disabled={isLoading}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-all duration-200 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "linear",
                          }}
                        >
                          <IoLogOutOutline size={14} />
                        </motion.div>
                      ) : (
                        <IoLogOutOutline size={14} />
                      )}
                      {isLoading ? "Logging out..." : "Log Out"}
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        <div className="flex-1 flex flex-col min-h-0">
          <nav className="flex-1 sm:overflow-y-auto overflow-y-hidden py-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent scroll-smooth">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-0.5 px-2 mb-1"
            >
              <SectionLabel>Main</SectionLabel>
              <MenuItem
                icon={<AiOutlineHome size={16} />}
                label="Home"
                active={selectedMenu === "Home"}
                onClick={() => handleClick("Home", "/")}
                onHover={setHovered}
                hovered={hovered}
              />
              <MenuItem
                icon={<AiOutlineDashboard size={16} />}
                label="Dashboard"
                active={selectedMenu === "Dashboard"}
                onClick={() => handleClick("Dashboard", "/dashboardmain")}
                onHover={setHovered}
                hovered={hovered}
              />
              <MenuItem
                icon={<AiOutlineCloudUpload size={16} />}
                label="Upload"
                active={selectedMenu === "Upload"}
                onClick={() => handleClick("Upload", "/uploadpage")}
                onHover={setHovered}
                hovered={hovered}
              />
            </motion.div>

            <Divider />

            {/* Business Modules */}
            {(roles[0]?.some((r) => r.rolename === "/ims") ||
              roles[0]?.some((r) => r.rolename === "/salestracker") ||
              roles[0]?.some((r) => r.rolename === "/accounting")) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-0.5 px-2 mb-1"
              >
                <SectionLabel>Business</SectionLabel>
                {roles[0]?.some((r) => r.rolename === "/ims") && (
                  <MenuItem
                    icon={<AiOutlineDatabase size={16} />}
                    label="Inventory"
                    active={selectedMenu === "IMS"}
                    onClick={() => handleClick("IMS", "/ims")}
                    onHover={setHovered}
                    hovered={hovered}
                  />
                )}

                {roles[0]?.some((r) => r.rolename === "/salestracker") && (
                  <MenuItem
                    icon={<AiOutlineBarChart size={16} />}
                    label="Sales Tracker"
                    active={selectedMenu === "salestracker"}
                    onClick={() => handleClick("salestracker", "/salestracker")}
                    onHover={setHovered}
                    hovered={hovered}
                  />
                )}
                {roles[0]?.some((r) => r.rolename === "/accounting") && (
                  <MenuItem
                    icon={<FaRegMoneyBillAlt size={16} />}
                    label="Accounting"
                    active={selectedMenu === "accounting"}
                    onClick={() => handleClick("accounting", "/accounting")}
                    onHover={setHovered}
                    hovered={hovered}
                  />
                )}
              </motion.div>
            )}

            {(roles[0]?.some((r) => r.rolename === "/ims") ||
              roles[0]?.some((r) => r.rolename === "/salestracker") ||
              roles[0]?.some((r) => r.rolename === "/accounting")) && (
              <Divider />
            )}

            {/* User Management */}
            {(roles[0]?.some((r) => r.rolename === "/hris") ||
              roles[0]?.some((r) => r.rolename === "/usersqueu") ||
              roles[0]?.some((r) => r.rolename === "/userroles")) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-0.5 px-2 mb-1"
              >
                <SectionLabel>User Management</SectionLabel>
                {roles[0]?.some((r) => r.rolename === "/hris") && (
                  <MenuItem
                    icon={<FaUserEdit size={16} />}
                    label="User Profile"
                    active={selectedMenu === "Hris"}
                    onClick={() => handleClick("Hris", "/hris")}
                    onHover={setHovered}
                    hovered={hovered}
                  />
                )}
                {roles[0]?.some((r) => r.rolename === "/usersqueu") && (
                  <MenuItem
                    icon={<FaUserCheck size={16} />}
                    label="User Approval"
                    active={selectedMenu === "User Approval"}
                    onClick={() => handleClick("User Approval", "/usersqueu")}
                    onHover={setHovered}
                    hovered={hovered}
                  />
                )}
                {roles[0]?.some((r) => r.rolename === "/userroles") && (
                  <MenuItem
                    icon={<FaUserCog size={16} />}
                    label="Roles"
                    active={selectedMenu === "Roles"}
                    onClick={() => handleClick("Roles", "/userroles")}
                    onHover={setHovered}
                    hovered={hovered}
                  />
                )}
              </motion.div>
            )}

            {(roles[0]?.some((r) => r.rolename === "/hris") ||
              roles[0]?.some((r) => r.rolename === "/usersqueu") ||
              roles[0]?.some((r) => r.rolename === "/userroles")) && (
              <Divider />
            )}

            {/* System */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-0.5 px-2 mb-2"
            >
              <SectionLabel>System</SectionLabel>
              <MenuItem
                icon={<FaBook size={16} />}
                label="Video Tutorial"
                active={selectedMenu === "Video Tutorial"}
                onClick={() => handleClick("Video Tutorial", "/video-tutorial")}
                onHover={setHovered}
                hovered={hovered}
              />
            </motion.div>
          </nav>
        </div>
      </motion.div>
    </>
  );
};

export default SidePanel;

// ------------------------------------------------------------------
const MenuItem = ({
  icon,
  label,
  active,
  onClick,
  onHover,
  hovered,
  isLogout = false,
}) => (
  <motion.div
    whileHover={{ scale: 1.01, x: 1 }}
    whileTap={{ scale: 0.99 }}
    className="list-none"
  >
    <button
      onMouseEnter={() => onHover(label)}
      onMouseLeave={() => onHover("")}
      onClick={onClick}
      className={`
        w-full flex items-center px-2.5 py-1.5 text-left rounded-lg
        transition-all duration-200 ease-in-out group relative overflow-hidden
        focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-transparent
        ${
          active
            ? "bg-gradient-to-r from-colorBrand to-colorBrandSecondary shadow-md shadow-colorBrand/20 text-white transform translate-x-0.5"
            : "hover:bg-gradient-to-r hover:from-slate-700/50 hover:to-slate-600/50 hover:border-slate-500/20 border border-transparent hover:shadow-sm hover:shadow-slate-500/10"
        }
      `}
    >
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 blur-lg -z-10"
        />
      )}

      <span
        className={`
        transition-all duration-200 flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0
        ${
          active
            ? "text-white bg-white/15 shadow-sm"
            : "text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-600/20"
        }
      `}
      >
        {icon}
      </span>

      <span
        className={`
        ml-2.5 flex-1 text-xs font-medium transition-all duration-200 truncate
        ${
          active
            ? "text-white font-semibold"
            : "text-slate-300 group-hover:text-white"
        }
      `}
      >
        {label}
      </span>

      {/* Hover indicator */}
      {hovered === label && !active && (
        <motion.div
          initial={{ opacity: 0, x: -5, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -5, scale: 0.9 }}
          className="text-xs text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-600/30 shadow-sm backdrop-blur-sm"
        >
          •
        </motion.div>
      )}

      {/* Active indicator */}
      {active && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-1.5 h-1.5 bg-white rounded-full shadow-sm flex-shrink-0"
        />
      )}
    </button>
  </motion.div>
);

const Divider = () => (
  <motion.div
    initial={{ opacity: 0, scaleX: 0 }}
    animate={{ opacity: 1, scaleX: 1 }}
    className="my-1.5 mx-3 relative"
  >
    <div className="border-t border-slate-600/20 relative">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-500/10 to-transparent blur-sm" />
    </div>
  </motion.div>
);

const SectionLabel = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, x: -5 }}
    animate={{ opacity: 1, x: 0 }}
    className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1 py-1 mb-0.5"
  >
    {children}
  </motion.div>
);
