import { useHydratePosRoleAccessSettings } from "../../hooks/usePosRoleAccessConfig";

const RoleAccessHydrator = () => {
  useHydratePosRoleAccessSettings();
  return null;
};

export default RoleAccessHydrator;
