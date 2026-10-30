import React, { useMemo } from "react";
import { Link, Outlet } from "react-router-dom";

import useZustandLoginCred from "../context/useZustandLoginCred";
import { FaBan } from "react-icons/fa";
import { hasPosRouteAccess } from "../utils/posRoleAccess";
import {
  usePosDeveloperSession,
  usePosRoleAccessVersion,
} from "../hooks/usePosRoleAccessConfig";

const PrivateRoute = ({ routename }) => {
  const { isAuthenticated, roles } = useZustandLoginCred();
  const roleAccessVersion = usePosRoleAccessVersion();
  const developerMode = usePosDeveloperSession();
  const canAccess = useMemo(
    () => hasPosRouteAccess(roles, routename, developerMode),
    [roles, routename, roleAccessVersion, developerMode],
  );

  if (isAuthenticated && canAccess) {
    return <Outlet />;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-200 to-gray-100 px-10 lg:px-0">
      <div
        className="ui-enter max-w-md w-full bg-white p-8 rounded-md shadow-lg text-center relative overflow-hidden"
      >
        <div
          className="ui-fade-in absolute top-0 left-0 w-full h-2 bg-blue-700"
        />
        <div
          className="ui-enter flex items-center justify-center w-20 h-20 mx-auto mb-4 bg-colorBrandLighter rounded-md"
        >
          <FaBan className="w-10 h-10 text-blue-700" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Oops!</h2>
        <p className="text-gray-600 mb-6">
          You don’t have access to{" "}
          <span className="font-semibold">{routename}</span>.
        </p>
        <div className="hover:scale-[1.05] active:scale-[0.95] transition-transform duration-150 motion-reduce:transform-none">
          <Link
            to="/poscorehomescreen"
            className="inline-block px-6 py-2 bg-blue-700 text-white rounded-md shadow-md"
          >
            Take Me Home
          </Link>
        </div>
        <div className="mt-4 text-sm text-gray-400">
          Need help? Contact support.
        </div>
      </div>
    </div>
  );
};

export default PrivateRoute;
