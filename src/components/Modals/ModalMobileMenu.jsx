import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import { motion } from "framer-motion";

// icons…
import {
  AiOutlineHome,
  AiOutlineDashboard,
  AiOutlineUpload,
  AiOutlineDatabase,
  AiOutlineBarChart,
} from "react-icons/ai";
import {
  FaRegMoneyBillAlt,
  FaUsers,
  FaTicketAlt,
  FaBook,
  FaUserCheck,
  FaUserEdit,
  FaUserCog,
} from "react-icons/fa";
import { IoKey, IoSettingsOutline } from "react-icons/io5";
import useZustandMobile from "../../context/useZustandMobile";
import { useCustomMutation } from "../../hooks/useCustomMutations";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const SidePanel = () => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  /*____________________________CONTEXTS__________________________________*/
  const { isAuthenticated, toggleAuthentication } = useZustandLoginCred();

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
      navigate("/");
    }
  }, [logoutData]);

  const navigate = useNavigate();

  const { isMobile, toggleIsMobile } = useZustandMobile();
  const { isDekstopSideMenu, toggleIsDesktopSideMenu } = useZustandSideMenu();
  const { selectedMenu, setSelectedMenu } = useZustandSideMenu();
  const [hovered, setHovered] = useState("");
  const { roles, firstName, profilePic, userId } = useZustandLoginCred();

  // ⬇️ click‐outside ref and handler
  const panelRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        toggleIsMobile();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [toggleIsDesktopSideMenu]);

  const handleClick = (key, path) => {
    setSelectedMenu(key);
    navigate(path);
    toggleIsMobile();
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
    <motion.div
      ref={panelRef} // ← attach ref here
      initial={{ x: "-100%", y: 50 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed left-0 top-0 h-screen w-64 bg-white border-r flex flex-col z-50 lg:block"
    >
      {/* Profile Header */}
      <div className="px-4 py-2 bg-gray-100 flex items-center space-x-3">
        <img
          src={handleFilterImageURL(profilePic)}
          alt="Avatar"
          onError={(e) => (e.currentTarget.src = "/default-avatar.png")}
          className="w-10 h-10 rounded-full object-cover border"
        />
        <div>
          <div className="text-gray-800 font-semibold">{firstName}</div>
          <div className="text-xs text-green-500">{userId}</div>
          <div className="text-xs text-green-500">Online</div>
        </div>
      </div>

      {/* Main Section */}
      <nav className="flex-1 overflow-y-auto">
        <ul className="mt-3">
          {/* Home & Dashboard */}
          <MenuItem
            icon={<AiOutlineHome size={20} />}
            label="Home"
            active={selectedMenu === "Home"}
            onClick={() => handleClick("Home", "/")}
            onHover={setHovered}
            hovered={hovered}
          />
          <MenuItem
            icon={<AiOutlineDashboard size={20} />}
            label="Dashboard"
            active={selectedMenu === "Dashboard"}
            onClick={() => handleClick("Dashboard", "/dashboardmain")}
            onHover={setHovered}
            hovered={hovered}
          />
        </ul>

        <Divider />

        {/* {roles[0]?.some((r) => r.rolename === "/uploadpage") && (
          <>
            <MenuItem
              icon={<AiOutlineUpload size={20} />}
              label="Upload"
              active={selectedMenu === "Upload"}
              onClick={() => handleClick("Upload", "/uploadpage")}
              onHover={setHovered}
              hovered={hovered}
            />
            <Divider />
          </>
        )} */}

        {roles[0]?.some((r) => r.rolename === "/ims") && (
          <>
            <MenuItem
              icon={<AiOutlineDatabase size={20} />}
              label="Inventory"
              active={selectedMenu === "IMS"}
              onClick={() => handleClick("IMS", "/ims")}
              onHover={setHovered}
              hovered={hovered}
            />
            <Divider />
          </>
        )}

        {roles[0]?.some((r) => r.rolename === "/salestracker") && (
          <>
            <MenuItem
              icon={<AiOutlineBarChart size={20} />}
              label="Sales Tracker"
              active={selectedMenu === "salestracker"}
              onClick={() => handleClick("salestracker", "/salestracker")}
              onHover={setHovered}
              hovered={hovered}
            />
            <Divider />
          </>
        )}

        {roles[0]?.some((r) => r.rolename === "/accounting") && (
          <>
            <MenuItem
              icon={<FaRegMoneyBillAlt size={20} />}
              label="Accounting"
              active={selectedMenu === "accounting"}
              onClick={() => handleClick("accounting", "/accounting")}
              onHover={setHovered}
              hovered={hovered}
            />
            <Divider />
          </>
        )}

        {roles[0]?.some((r) => r.rolename === "/hris") && (
          <>
            <MenuItem
              icon={<FaUserEdit size={20} />}
              label="User Profile"
              active={selectedMenu === "Hris"}
              onClick={() => handleClick("Hris", "/hris")}
              onHover={setHovered}
              hovered={hovered}
            />
            <Divider />
          </>
        )}

        {roles[0]?.some((r) => r.rolename === "/usersqueu") && (
          <>
            <MenuItem
              icon={<FaUserCheck size={20} />}
              label="User Approval"
              active={selectedMenu === "User Approval"}
              onClick={() => handleClick("User Approval", "/usersqueu")}
              onHover={setHovered}
              hovered={hovered}
            />
            <Divider />
          </>
        )}

        {roles[0]?.some((r) => r.rolename === "/userroles") && (
          <>
            <MenuItem
              icon={<FaUserCog size={20} />}
              label="Roles"
              active={selectedMenu === "Roles"}
              onClick={() => handleClick("Roles", "/userroles")}
              onHover={setHovered}
              hovered={hovered}
            />
            <Divider />
          </>
        )}

        {/* {roles[0]?.some((r) => r.rolename === "/ticket") && (
          <>
            <MenuItem
              icon={<FaTicketAlt size={20} />}
              label="Ticket"
              active={selectedMenu === "Ticket"}
              onClick={() => handleClick("Ticket", "/ticket")}
              onHover={setHovered}
              hovered={hovered}
            />
            <Divider />
          </>
        )} */}

        {/* Documentation & Settings */}
        <MenuItem
          icon={<FaBook size={20} />}
          label="Documentation"
          active={selectedMenu === "Documentation"}
          onClick={() => handleClick("Documentation", "/aboutus")}
          onHover={setHovered}
          hovered={hovered}
        />
        <Divider />

        {roles[0]?.some((r) => r.rolename === "/settings") && (
          <>
            <MenuItem
              icon={<IoSettingsOutline size={20} />}
              label="Settings"
              active={selectedMenu === "Settings"}
              onClick={() => handleClick("Settings", "/settings")}
              onHover={setHovered}
              hovered={hovered}
            />
            <Divider />
          </>
        )}

        {isAuthenticated && (
          <MenuItem
            icon={<IoKey size={20} />}
            label="Logout"
            active={selectedMenu === "Logout"}
            onClick={() => handleLogout()}
            onHover={setHovered}
            hovered={hovered}
          />
        )}
      </nav>
    </motion.div>
  );
};

export default SidePanel;

// ------------------------------------------------------------------

const MenuItem = ({ icon, label, active, onClick, onHover, hovered }) => (
  <li className="list-none">
    <button
      onMouseEnter={() => onHover(label)}
      onMouseLeave={() => onHover("")}
      onClick={onClick}
      className={`
        w-full flex items-center px-4 py-2 text-left
        transition-colors duration-150
        ${active ? "bg-redAccent" : "hover:bg-gray-100"}
      `}
    >
      <span className={`${active ? "text-white" : "text-gray-600"}`}>
        {icon}
      </span>
      <span
        className={`
          ml-3 flex-1 text-sm font-medium
          ${active ? "text-white" : "text-gray-800"}
          ${label === "Logout" ? "text-redAccent" : "text-gray-800"}
        `}
      >
        {label}
      </span>
      {hovered === label && <div className="text-xs text-gray-500">Select</div>}
    </button>
  </li>
);

const Divider = () => <div className="border-t my-2 mx-4" />;
