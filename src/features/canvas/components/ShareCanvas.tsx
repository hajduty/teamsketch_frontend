import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Select, SelectOption } from "../../../components/Select";

const ROLE_OPTIONS: SelectOption<string>[] = [
  { value: "viewer", label: "Viewer", description: "Can view the room" },
  { value: "editor", label: "Editor", description: "Can draw and edit" },
];
import { useState, useEffect } from "react";
import { Button } from "../../../components/Button";
import Icon from "../../../components/Icon";
import { apiRoutes } from "../../../lib/apiRoutes";
import apiClient from "../../../lib/apiClient";
import { useAuth } from "../../auth/AuthProvider";
import { useSignalR } from "../../auth/ProtectedRoute";
import { Permissions } from "../../../types/permission";

const GuestView = ({
  onClose,
  isVisible,
}: {
  onClose: () => void;
  isVisible: boolean;
}) => {
  const navigate = useNavigate();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className={`bg-surface text-white rounded-xl p-6 w-96 max-w-[90vw] border border-line flex flex-col gap-4 shadow-lg
          transform transition-all duration-200 ease-in-out
          ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Share room</h2>
          <Button
            onClick={onClose}
            className="hover:bg-raised border border-transparent p-1 rounded-md transition-colors"
          >
            <Icon iconName="close" color="white" fontSize="16px" />
          </Button>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-accent-soft rounded-full flex items-center justify-center flex-shrink-0">
            <Icon iconName="devices" color="#3b82f6" fontSize="18px" />
          </div>
          <p className="text-ink text-sm leading-relaxed">
            As a guest, your canvases are saved on this device only. Create an account to share
            rooms and draw together.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            onClick={() => navigate("/login")}
            className="hover:bg-raised text-sm px-3 h-9 rounded-md transition-colors text-ink-muted"
          >
            Log in
          </Button>
          <Button
            onClick={() => navigate("/register")}
            className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-3 h-9 rounded-md transition-colors"
          >
            Create account
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ShareCanvas = ({ roomId }: { roomId: string }) => {
  const { guest } = useAuth();
  const { connection } = useSignalR();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("editor");
  const [permissions, setPermissions] = useState<Permissions[]>([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const fetchPermissions = async () => {
    while (!connection || connection.state !== "Connected") {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!connection) return;
    try {
      const response = await connection.invoke<Permissions[]>(
        "GetPermissionsForRoom",
        roomId
      );
      setPermissions(response);
    } catch (err) {
      console.error("Failed to fetch permissions", err);
    }
  };

  const updateUserRole = async (userEmail: string, newRole: string) => {
    const permission = permissions.find((p) => p.userEmail === userEmail);
    if (!permission) return;

    try {
      await apiClient.put(apiRoutes.permission.edit, {
        ...permission,
        role: newRole,
      });
      setPermissions((prev) =>
        prev.map((p) =>
          p.userEmail === userEmail ? { ...p, role: newRole } : p
        )
      );
    } catch (err) {
      console.error("Update role failed", err);
      setError("Failed to update user role");
    }
  };

  const addUser = async () => {
    if (!userEmail || !roomId) return;
    try {
      await apiClient.post(apiRoutes.permission.add, {
        userEmail,
        room: roomId,
        role: selectedRole,
      });
      setUserEmail("");
      setSuccessMessage("All done! Send this link to your friend:");
      setError("");
      await fetchPermissions();
    } catch (err) {
      console.error("Add user failed", err);
      setError("Failed to add user");
    }
  };

  const deleteUser = async (perm: Permissions) => {
    try {
      await apiClient.delete(
        apiRoutes.permission.remove(perm.room, perm.userId)
      );
      setPermissions((prev) =>
        prev.filter((p) => p.userEmail !== perm.userEmail)
      );
    } catch (err) {
      console.error("Delete user failed", err);
      setError("Failed to delete user");
    }
  };

  const copyToClipboard = () => {
    const link = `${window.location.origin}/${roomId}`;
    navigator.clipboard.writeText(link);
    setSuccessMessage("Copied!");
  };

  useEffect(() => {
    if (isModalOpen && !guest && roomId) {
      fetchPermissions();
    }
  }, [isModalOpen, guest, roomId]);

  const openModal = () => {
    setIsModalOpen(true);
    requestAnimationFrame(() => setIsVisible(true));
  };

  const closeModal = () => {
    setIsVisible(false);
    setError("");
    setSuccessMessage("");
    setTimeout(() => setIsModalOpen(false), 200);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label="Share"
        className="share-canvas flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 max-sm:px-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium cursor-pointer transition-colors"
      >
        <Icon iconName="person_add" fontSize="18px" />
        <span className="max-sm:hidden">Share</span>
      </button>

      {/* Guest view */}
      {isModalOpen && guest && createPortal(
        <>
          <div
            className={`fixed inset-0 bg-black transition-opacity duration-200 ${
              isVisible ? "opacity-60" : "opacity-0"
            } z-40`}
          />
          <GuestView
            onClose={closeModal}
            isVisible={isVisible}
          />
        </>,
        document.body
      )}

      {/* Authenticated view */}
      {isModalOpen && !guest && createPortal(
        <>
          <div
            className={`fixed inset-0 bg-black transition-opacity duration-200 ${
              isVisible ? "opacity-60" : "opacity-0"
            } z-40`}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={closeModal}
          >
            <div
              className={`bg-surface text-white rounded-xl p-6 w-[32rem] max-w-[90vw] max-h-[85vh] overflow-y-auto border border-line flex flex-col gap-5 shadow-lg
                transform transition-all duration-200 ease-in-out
                ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
              `}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-accent-soft rounded-full flex items-center justify-center">
                    <Icon iconName="share" color="#3b82f6" fontSize="18px" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Share room
                  </h2>
                </div>
                <Button
                  onClick={closeModal}
                  className="hover:bg-raised border border-transparent p-1 rounded-md transition-colors"
                >
                  <Icon iconName="close" color="white" fontSize="16px" />
                </Button>
              </div>

              {/* Invite section */}
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <input
                  placeholder="User email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="flex-1 min-w-0 h-9 rounded-md border border-line-strong bg-canvas px-3 text-sm placeholder:text-ink-faint text-ink outline-none focus:border-accent transition-colors"
                />

                <Select
                  label="Role"
                  value={selectedRole}
                  options={ROLE_OPTIONS}
                  onChange={setSelectedRole}
                  className="w-28"
                />

                <Button
                  onClick={addUser}
                  className="bg-accent hover:bg-accent-hover text-white px-3 py-2 rounded-md flex items-center gap-1 text-sm font-medium transition-colors"
                >
                  <Icon iconName="add" color="white" fontSize="16px" />
                  Add
                </Button>
              </div>

              {/* Status messages */}
              {error && (
                <p className="text-red-500 text-sm font-medium">{error}</p>
              )}

              {successMessage && (
                <div className="bg-green-900/40 border border-green-700 text-green-300 p-3 rounded-md flex flex-col gap-2 text-sm">
                  <p>{successMessage}</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      className="bg-canvas text-ink px-3 h-9 border border-line-strong flex-1 rounded-md text-sm outline-none focus:border-accent"
                      value={`${window.location.origin}/${roomId}`}
                    />
                    <Button
                      onClick={copyToClipboard}
                      className="bg-raised hover:bg-raised text-sm px-3 py-2 rounded-md transition-colors"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              {/* Accordion */}
              <div>
                <h3
                  className="font-medium mb-2 cursor-pointer flex items-center gap-1 select-none text-ink"
                  onClick={() => setIsAccordionOpen((prev) => !prev)}
                >
                  <Icon
                    iconName={
                      isAccordionOpen ? "expand_less" : "expand_more"
                    }
                    color="white"
                    fontSize="18px"
                  />
                  People with access
                </h3>

                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isAccordionOpen ? "max-h-64" : "max-h-0"
                  }`}
                >
                  <ul className="text-sm space-y-2">
                    {permissions.map((perm) => (
                      <li
                        key={perm.userEmail}
                        className="flex justify-between items-center border border-line rounded-md p-2 bg-canvas/60"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-ink">
                            {perm.userEmail}
                            {perm.role === "Owner" && (
                              <span className="text-ink-faint text-xs ml-1">
                                (Owner)
                              </span>
                            )}
                          </span>

                          {perm.role !== "Owner" && (
                            <Select
                              label={`Role for ${perm.userEmail}`}
                              size="sm"
                              value={perm.role}
                              options={ROLE_OPTIONS}
                              onChange={(role) => updateUserRole(perm.userEmail, role)}
                              className="w-24"
                            />
                          )}
                        </div>

                        {perm.role !== "Owner" && (
                          <Button
                            onClick={() => deleteUser(perm)}
                            className="border border-line hover:bg-raised p-1 rounded-md transition-colors"
                          >
                            <Icon iconName="delete" color="#ef4444" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
};
