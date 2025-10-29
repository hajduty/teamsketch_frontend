import { useState, useEffect } from "react";
import { Button } from "../../../components/Button";
import Icon from "../../../components/Icon";
import { apiRoutes } from "../../../lib/apiRoutes";
import apiClient from "../../../lib/apiClient";
import { useAuth } from "../../auth/AuthProvider";
import { useSignalR } from "../../auth/ProtectedRoute";
import { Permissions } from "../../../types/permission";

const GuestView = ({
  roomId,
  onClose,
  isVisible,
}: {
  roomId: string;
  onClose: () => void;
  isVisible: boolean;
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const link = `${window.location.origin}/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className={`bg-neutral-950 text-white rounded-md p-6 w-96 max-w-[90vw] border border-neutral-700 flex flex-col gap-4 shadow-lg
          transform transition-all duration-200 ease-in-out
          ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Share Canvas</h2>
          <Button
            onClick={onClose}
            className="hover:bg-neutral-800 border border-transparent p-1 rounded-md transition-colors"
          >
            <Icon iconName="close" color="white" fontSize="16px" />
          </Button>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Icon iconName="share" color="#3b82f6" fontSize="18px" />
          </div>
          <p className="text-neutral-300 text-sm leading-relaxed">
            This canvas is public! Just copy this link to share it with anyone.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            readOnly
            className="bg-neutral-900 text-white px-3 py-2 border border-neutral-700 flex-1 rounded-md text-sm"
            value={`${window.location.origin}/${roomId}`}
          />
          <Button
            onClick={copyToClipboard}
            className="bg-neutral-800 hover:bg-neutral-700 text-sm px-3 py-2 rounded-md transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
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
      <div className="fixed top-0 right-14 m-4 z-2 share-canvas">
        <button
          onClick={openModal}
          className="p-2 cursor-pointer bg-blue-600 border border-blue-500 rounded-md flex hover:bg-blue-500 transition duration-75"
        >
          <Icon iconName="share" color="white" />
        </button>
      </div>

      {/* Guest view */}
      {isModalOpen && guest && (
        <>
          <div
            className={`fixed inset-0 bg-black transition-opacity duration-200 ${
              isVisible ? "opacity-80" : "opacity-0"
            } z-30`}
          />
          <GuestView
            roomId={roomId}
            onClose={closeModal}
            isVisible={isVisible}
          />
        </>
      )}

      {/* Authenticated view */}
      {isModalOpen && !guest && (
        <>
          <div
            className={`fixed inset-0 bg-black transition-opacity duration-200 ${
              isVisible ? "opacity-80" : "opacity-0"
            } z-30`}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={closeModal}
          >
            <div
              className={`bg-neutral-950 text-white rounded-md p-6 w-[32rem] max-w-[90vw] max-h-[85vh] overflow-y-auto border border-neutral-700 flex flex-col gap-5 shadow-lg
                transform transition-all duration-200 ease-in-out
                ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
              `}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <Icon iconName="share" color="#3b82f6" fontSize="18px" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Share Canvas
                  </h2>
                </div>
                <Button
                  onClick={closeModal}
                  className="hover:bg-neutral-800 border border-transparent p-1 rounded-md transition-colors"
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
                  className="flex-1 min-w-0 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm placeholder:text-neutral-400 text-white focus:outline-none"
                />

                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>

                <Button
                  onClick={addUser}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md flex items-center gap-1 text-sm font-medium transition-colors"
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
                      className="bg-neutral-900 text-white px-3 py-2 border border-neutral-700 flex-1 rounded-md text-sm"
                      value={`${window.location.origin}/${roomId}`}
                    />
                    <Button
                      onClick={copyToClipboard}
                      className="bg-neutral-800 hover:bg-neutral-700 text-sm px-3 py-2 rounded-md transition-colors"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              {/* Accordion */}
              <div>
                <h3
                  className="font-medium mb-2 cursor-pointer flex items-center gap-1 select-none text-neutral-300"
                  onClick={() => setIsAccordionOpen((prev) => !prev)}
                >
                  <Icon
                    iconName={
                      isAccordionOpen ? "expand_less" : "expand_more"
                    }
                    color="white"
                    fontSize="18px"
                  />
                  Added Users
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
                        className="flex justify-between items-center border border-neutral-700 rounded-md p-2 bg-neutral-900/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-200">
                            {perm.userEmail}
                            {perm.role === "Owner" && (
                              <span className="text-neutral-500 text-xs ml-1">
                                (Owner)
                              </span>
                            )}
                          </span>

                          {perm.role !== "Owner" && (
                            <select
                              value={perm.role}
                              onChange={(e) =>
                                updateUserRole(
                                  perm.userEmail,
                                  e.target.value
                                )
                              }
                              className="bg-neutral-900 border border-neutral-700 text-white rounded px-2 py-1 text-sm"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="editor">Editor</option>
                            </select>
                          )}
                        </div>

                        {perm.role !== "Owner" && (
                          <Button
                            onClick={() => deleteUser(perm)}
                            className="border border-neutral-700 hover:bg-neutral-800 p-1 rounded-md transition-colors"
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
        </>
      )}
    </>
  );
};
