import React from "react";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import SidePanel from "../../components/MainComponents/SidePanel";
import UserInfoPanel from "../../components/MainComponents/UserInfoPanel";
import useZustandMobile from "../../context/useZustandMobile";
import ModalMobileMenu from "../../components/Modals/ModalMobileMenu";
import CmpMemberProfile from "../../components/Hris/CmpMemberProfile";

const MemberProfile = () => {
  const { isMobile, toggleIsMobile } = useZustandMobile();
  const { isDekstopSideMenu, toggleIsDesktopSideMenu } = useZustandSideMenu();

  return (
    <>

      <div className="flex flex-row overflow-x-hidden mt-10 ms-0 p-2  justify-center">
        <CmpMemberProfile />
      </div>
    </>
  );
};

export default MemberProfile;
