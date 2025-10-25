import { useState, useEffect } from "react";
import { Button } from "../../../components/Button";
import Icon from "../../../components/Icon";
import { useAuth } from "../../auth/AuthProvider";
import apiClient from "../../../lib/apiClient";
import { apiRoutes } from "../../../lib/apiRoutes";
import { Permissions } from "../../../types/permission";

interface DeletePopupProps {
  isOpen: boolean;
  onClose: () => void;
  room: Permissions;
}

export const DeletePopup = ({ 
  isOpen, 
  onClose,
  room
}: DeletePopupProps) => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      setIsDeleting(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 200);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleDeleteRoom = async () => {
    if (!user?.id) {
      return;
    }

    setIsDeleting(true);

    try {
      await apiClient.delete(apiRoutes.permission.remove(room.room, user.id));
    } catch (error) {
      console.error('Error deleting room:', error);
    } finally {
      setIsDeleting(false);
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-200 ${
          isVisible ? "opacity-80" : "opacity-0"
        } z-10`}
        onClick={handleBackdropClick}
      />
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center`}
        onClick={handleBackdropClick}
      >
        <div
          className={`bg-neutral-950 text-white rounded-md p-6 w-96 max-w-[90vw] border border-neutral-700 flex flex-col gap-4 shadow-lg
            transform transition-all duration-200 ease-in-out
            ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex flex-row justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Delete Room</h2>
            <Button
              onClick={handleClose}
              className="hover:bg-neutral-800 border border-transparent p-1 rounded-md transition-colors"
            >
              <Icon iconName="close" color="white" fontSize="16px" />
            </Button>
          </div>

          {/* Warning Message */}
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon iconName="warning" color="#ef4444" fontSize="20px" />
              </div>
              <p className="text-neutral-300 text-sm leading-relaxed">
                Are you sure you want to remove this room? This action cannot be undone and all its contents will permanently be deleted.
              </p>
            </div>
          </div>

          <div className="bg-neutral-900/50 rounded p-3 space-y-1 text-xs">
            <p><span className="font-semibold">RoomId:</span> {room.room}</p>
            <p><span className="font-semibold">Role:</span> {room.role}</p>
            <p><span className="font-semibold">Created At:</span> {
              room.createdAt instanceof Date 
                ? room.createdAt.toLocaleDateString()
                : new Date(room.createdAt!).toLocaleDateString()
            }</p>
          </div>

          <div className="flex flex-row gap-3 justify-end mt-2">
            <Button
              onClick={handleClose}
              className="px-4 py-2 rounded border border-neutral-600 hover:bg-neutral-800 transition-colors text-sm disabled:opacity-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteRoom}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Icon iconName="loading" />
                  Deleting...
                </>
              ) : (
                'Delete Room'
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
