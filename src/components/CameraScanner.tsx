import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, RefreshCw, X } from 'lucide-react';

interface CameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScanSuccess, onClose }) => {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const elementId = "camera-scanner-view";

  useEffect(() => {
    // Request permission and detect cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/rear/environment camera if available
          const backCam = devices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('environment') ||
            device.label.toLowerCase().includes('خلفية')
          );
          setActiveCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setError("لم يتم العثور على أي كاميرا متصلة بالجهاز.");
        }
      })
      .catch((err) => {
        console.error("Camera access error:", err);
        setError("فشل الوصول إلى الكاميرا. يرجى التأكد من منح صلاحية الكاميرا للمتصفح.");
      });

    return () => {
      stopScanning();
    };
  }, []);

  useEffect(() => {
    if (activeCameraId) {
      startScanning(activeCameraId);
    }
  }, [activeCameraId]);

  const startScanning = async (cameraId: string) => {
    await stopScanning();

    try {
      const html5QrCode = new Html5Qrcode(elementId);
      qrCodeRef.current = html5QrCode;
      setIsScanning(true);
      setError('');

      await html5QrCode.start(
        cameraId,
        {
          fps: 20,
          qrbox: (width, height) => {
            // Wide rectangular scanning box optimized for barcodes
            const boxWidth = Math.min(width * 0.85, 320);
            const boxHeight = Math.min(height * 0.45, 120);
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.777778
        },
        (decodedText) => {
          // Trigger successful scan
          onScanSuccess(decodedText.trim());
          stopScanning();
        },
        () => {
          // Silence verbose decoding logs
        }
      );
    } catch (err: any) {
      console.error(err);
      setError("عذراً، فشل تشغيل محرك الكاميرا: " + (err.message || err));
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (qrCodeRef.current && qrCodeRef.current.isScanning) {
      try {
        await qrCodeRef.current.stop();
      } catch (err) {
        console.error("Failed to stop scanning", err);
      }
    }
    qrCodeRef.current = null;
    setIsScanning(false);
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setActiveCameraId(cameras[nextIndex].id);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col justify-center items-center z-50 p-4 backdrop-blur-md no-print" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <Camera className="text-emerald-400" size={18} />
            <h3 className="font-extrabold text-white text-sm">قارئ الباركود الذكي بالكاميرا</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 px-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-all duration-200 rounded-full text-xs font-semibold flex items-center gap-1 border border-red-500/20"
          >
            إلغاء <X size={14} />
          </button>
        </div>

        {/* Camera Stage Container */}
        <div className="relative bg-black flex-1 flex flex-col justify-center items-center min-h-[320px]">
          {error ? (
            <div className="p-6 text-center space-y-4">
              <span className="inline-flex p-3 bg-orange-500/10 text-orange-400 rounded-full">⚠</span>
              <p className="text-orange-400 font-bold text-sm">{error}</p>
              <div className="text-xs text-gray-500 leading-relaxed text-right max-w-xs space-y-1 bg-slate-850 p-2 rounded-xl">
                <p>💡 للعمل بشكل سليم:</p>
                <p>1. اسمح بالوصول للكاميرا عندما يطلب المتصفح ذلك.</p>
                <p>2. إذا كنت تستخدم هاتف ذكي، تأكد من إغلاق أي تطبيقات أخرى تستخدم الكاميرا.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overlay guidelines with precise scanning box and red laser */}
              <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                <div className="w-[85%] h-[110px] border-2 border-emerald-400 border-dashed rounded-xl relative flex items-center justify-center shadow-[0_0_30px_rgba(52,211,153,0.15)] bg-emerald-500/5">
                  {/* Glowing dynamic horizontal running red scanning laser line */}
                  <div className="absolute inset-x-2 h-0.5 bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-bounce top-1/2"></div>
                  <span className="absolute bottom-2.5 text-[10px] text-emerald-400 font-extrabold bg-slate-950/80 px-2 rounded-md">ضع ملصق الباركود هنا بوضوح</span>
                </div>
              </div>

              {/* Real HTML5 Qrcode viewport window */}
              <div id={elementId} className="w-full h-full min-h-[320px] bg-black"></div>
            </>
          )}
        </div>

        {/* Footer/Camera Selector controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex flex-col gap-3">
          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition-all border border-slate-700 active:scale-95"
            >
              <RefreshCw size={14} />
              تبديل الكاميرا النشطة
            </button>
          )}
          <div className="text-center text-[11px]">
            {isScanning ? (
              <span className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                الكاميرا في بث مباشر ومستعدة لالتقاط أي باركود تلقائياً
              </span>
            ) : (
              <span className="text-red-400 font-bold">جاري إيقاف الكاميرا...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
