import { createPortal } from "react-dom";
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
      <button
        type="button"
        onClick={openModal}
        aria-label="Account"
        title={user?.email ?? "Account"}
        className="flex items-center justify-center size-9 rounded-lg cursor-pointer hover:bg-raised transition-colors"
      >
        <span className="flex items-center justify-center size-7 rounded-full bg-raised border border-line-strong text-xs font-semibold text-ink uppercase">
          {user?.email?.[0] ?? "?"}
        </span>
      </button>

      {isModalOpen && createPortal(
        <>
          <div
            className={`fixed inset-0 bg-black transition-opacity duration-200 ${
              isVisible ? "opacity-60" : "opacity-0"
            } z-40`}
            onClick={closeModal}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={closeModal}
          >
            <div
              className={`bg-surface text-white rounded-xl p-5 sm:w-[380px] w-5/6 border border-line flex flex-col gap-4 shadow-lg
                transform transition-all duration-200 ease-in-out
                ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
              `}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-accent-soft rounded-full flex items-center justify-center">
                    <Icon iconName="person" color="#3b82f6" fontSize="16px" />
                  </div>
                  <h2 className="text-lg font-semibold">Account</h2>
                </div>
                <Button
                  onClick={closeModal}
                  className="hover:bg-raised border border-transparent p-1 rounded-md transition-colors"
                >
                  <Icon iconName="close" color="white" fontSize="16px" />
                </Button>
              </div>

              {/* User Details */}
              {user ? (
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex justify-between border-b border-line pb-1">
                    <span className="text-ink-muted">Email</span>
                    <span className="text-white">{user.email}</span>
                  </div>
                  <div className="flex justify-between border-b border-line pb-1">
                    <span className="text-ink-muted">User ID</span>
                    <span className="text-white">{user.id || "—"}</span>
                  </div>
                </div>
              ) : (
                <p className="text-ink-muted text-sm">
                  No user information available.
                </p>
              )}

              {/* Logout Button */}
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={logout}
                  className="bg-danger/12 hover:bg-danger/20 text-danger px-3 h-9 rounded-lg transition-colors duration-100 flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                >
                  <Icon iconName="logout" color="white" fontSize="16px" />
                  Log out
                </Button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
};
