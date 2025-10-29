import { useState } from "react";
import { Button } from "../../../components/Button";
import Icon from "../../../components/Icon";
import { useAuth } from "../../auth/AuthProvider";

export const UserInfo = () => {
  const { user, logout } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const openModal = () => {
    setIsModalOpen(true);
    requestAnimationFrame(() => setIsVisible(true));
  };

  const closeModal = () => {
    setIsVisible(false);
    setTimeout(() => setIsModalOpen(false), 200);
  };

  return (
    <>
      <div className="fixed top-0 right-0 m-4">
        <button
          onClick={openModal}
          className="p-2 cursor-pointer bg-blue-600 border border-blue-500 rounded-md flex hover:bg-blue-500 transition duration-75"
        >
          <Icon iconName="account_circle" color="white" />
        </button>
      </div>

      {isModalOpen && (
        <>
          <div
            className={`absolute inset-0 bg-black transition-opacity duration-200 ${
              isVisible ? "opacity-80" : "opacity-0"
            } z-10`}
            onClick={closeModal}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={closeModal}
          >
            <div
              className={`bg-neutral-950 text-white rounded-md p-5 sm:w-[380px] w-5/6 border border-neutral-700 flex flex-col gap-4 shadow-lg
                transform transition-all duration-200 ease-in-out
                ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
              `}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <Icon iconName="person" color="#3b82f6" fontSize="16px" />
                  </div>
                  <h2 className="text-lg font-semibold">User Info</h2>
                </div>
                <Button
                  onClick={closeModal}
                  className="hover:bg-neutral-800 border border-transparent p-1 rounded-md transition-colors"
                >
                  <Icon iconName="close" color="white" fontSize="16px" />
                </Button>
              </div>

              {/* User Details */}
              {user ? (
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex justify-between border-b border-neutral-800 pb-1">
                    <span className="text-neutral-400">Email</span>
                    <span className="text-white">{user.email}</span>
                  </div>
                  <div className="flex justify-between border-b border-neutral-800 pb-1">
                    <span className="text-neutral-400">User ID</span>
                    <span className="text-white">{user.id || "—"}</span>
                  </div>
                </div>
              ) : (
                <p className="text-neutral-400 text-sm">
                  No user information available.
                </p>
              )}

              {/* Logout Button */}
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={logout}
                  className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-md text-white transition duration-100 flex items-center gap-1"
                >
                  <Icon iconName="logout" color="white" fontSize="16px" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
