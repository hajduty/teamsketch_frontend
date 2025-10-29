import { useNavigate } from 'react-router-dom';
import bg from '../../assets/bg.png';
import Icon from '../../components/Icon';
import { useSignalR } from '../../features/auth/ProtectedRoute';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Permissions } from '../../types/permission';
import { NewRoomButton } from '../../components/NewRoomButton';
import { apiRoutes } from '../../lib/apiRoutes';
import { generateRoomId } from '../../utils/utils';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../features/auth/AuthProvider';

const RoomItem = ({ roomItem, navigate }: { roomItem: Permissions, navigate: (path: string) => void; }) => {
  return (
    <>
      <div className='w-full border-1 border-r-zinc-700 border-zinc-800 text-white p-4 rounded-lg flex flex-row items-center justify-between'>
        <div className='flex flex-col'>
          <h1>{roomItem.room}</h1>
          <p className='text-sm text-neutral-500'>{roomItem.role}</p>
          <p className='text-xs text-neutral-600'>{
            roomItem.createdAt instanceof Date
              ? roomItem.createdAt.toLocaleDateString()
              : new Date(roomItem.createdAt!).toLocaleDateString()
          }
          </p>
        </div>
        <button className='cursor-pointer' onClick={() => navigate(roomItem.room)}>
          <Icon fontSize="32px" iconName='arrow_forward'></Icon>
        </button>
      </div>
    </>
  );
}

export const RoomNotFound = () => {
  const { connection } = useSignalR();
  const [rooms, setRooms] = useState<Permissions[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [creating, setCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [topOpacity, setTopOpacity] = useState(0);
  const [bottomOpacity, setBottomOpacity] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const createNewRoom = useCallback(async () => {
    setCreating(true);
    try {
      const uuid = generateRoomId();
      const permission: Permissions = {
        role: "Owner",
        room: uuid,
        userId: user?.id!,
        userEmail: user?.email!,
      };

      const response = await apiClient.post(apiRoutes.permission.add, permission);
      const newRoom: Permissions = response.data;

      setTimeout(() => {
        setRooms(prev =>
          prev.some(r => r.room === newRoom.room) ? prev : [...prev, newRoom]
        );
      }, 1000);

      return newRoom.room;
    } catch (err) {
      console.error("Failed to create room:", err);
    } finally {
      setCreating(false);
    }
  }, [user?.id, user?.email]);

  const handleNavigate = (roomId: string) => {
    navigate(`/${roomId}`, { replace: true })
  }

  const handleScroll = () => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const maxScroll = scrollHeight - clientHeight;
    
    const topProgress = Math.min(scrollTop / 50, 1);
    const bottomProgress = Math.min((maxScroll - scrollTop) / 50, 1);
    
    setTopOpacity(topProgress);
    setBottomOpacity(bottomProgress);
  };

  useEffect(() => {
    if (!connection) return;

    const fetchRooms = async () => {
      while (!connection || connection.state !== "Connected") {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      try {
        const response = await connection.invoke<Permissions[]>("GetRooms");
        if (response) setRooms(response);
      } catch (err) {
        console.error("Failed to fetch rooms", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRooms();
  }, [connection]);

  useEffect(() => {
    if (scrollRef.current) {
      handleScroll();
    }
  }, [rooms]);

  return (
    <>
      <div className='bg-neutral-950'>
        <img
          src={bg}
          alt=""
          draggable={false}
          className="absolute h-full w-full scale-100 object-cover opacity-50 -inset-y-32 blur-xl"
        />
        <div className='bg-gradient-to-t from-neutral-950 from-65% to-transparent absolute
         top-0 left-0 w-full h-full' />
        <div className="flex flex-row justify-middle justify-center items-center h-screen">
          <div className='flex flex-col gap-32 z-4 w-4/5 lg:w-2/5'>
            <h1 className='text-white text-3xl text-center'>This room does not exist</h1>
            <div className='flex flex-col gap-4 text-white'>
              {!isLoading && rooms.length === 0 && (
                <NewRoomButton createNewRoom={createNewRoom} creating={creating} />
              )}

              {!isLoading && rooms.length > 0 && (
                <>
                  <p className="text-neutral-400 select-none">Your rooms</p>
                  <div className='relative'>
                    <div 
                      ref={scrollRef}
                      className='max-h-96 overflow-y-auto no-scrollbar flex flex-col gap-4'
                      onScroll={handleScroll}
                    >
                      {rooms.map((perm, index) => (
                        <RoomItem key={index} navigate={handleNavigate} roomItem={perm} />
                      ))}
                    </div>
                    
                    <div 
                      className='absolute top-0 left-0 right-0 h-16 pointer-events-none transition-opacity duration-300 bg-gradient-to-b from-neutral-950 to-transparent'
                      style={{ opacity: topOpacity }}
                    />
                    
                    <div 
                      className='absolute bottom-0 left-0 right-0 h-16 pointer-events-none transition-opacity duration-300 bg-gradient-to-t from-neutral-950 to-transparent'
                      style={{ opacity: bottomOpacity }}
                    />
                  </div>
                </>
              )}

              {isLoading && (
                <p className="text-neutral-500 text-center">Loading your rooms...</p>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}