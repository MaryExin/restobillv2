import React from "react";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import HamBurgerFloatingMenu from "../common/HamburgerFloating";
import { panelToolsAccounting } from "../common/options/options";
import SidePanel from "../MainComponents/SidePanel";
import UserInfoPanel from "../MainComponents/UserInfoPanel";
import useZustandMobile from "../../context/useZustandMobile";
import ModalMobileMenu from "../Modals/ModalMobileMenu";

export default function Layout({ children }) {
  const { isMobile, toggleIsMobile } = useZustandMobile();
  const { isDekstopSideMenu } = useZustandSideMenu();

  return (
    <>
      {(isDekstopSideMenu || isMobile) && <SidePanel />}
      <UserInfoPanel toggleIsMobile={toggleIsMobile} />
      {/* <HamBurgerFloatingMenu hamburgerMenu={panelToolsAccounting} /> */}
      <div className="flex flex-row overflow-x-hidden mt-10 ms-0 p-2 justify-center bg-gray-50">
        {children}
      </div>
    </>
  );
}
