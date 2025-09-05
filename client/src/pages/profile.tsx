import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Settings, Camera, Save, Lock, ArrowLeft, Upload, ImageIcon, X, RotateCw, ZoomIn, ZoomOut, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getAuthHeaders } from "@/lib/authUtils";
import { updateProfileSchema, changePasswordSchema, type UpdateProfileData, type ChangePasswordData } from "@shared/schema";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

// Country codes data - Comprehensive list with major countries
const countryCodes = [
  { id: "uz", code: "+998", country: "🇺🇿 O'zbekiston", flag: "🇺🇿" },
  { id: "us", code: "+1", country: "🇺🇸 United States", flag: "🇺🇸" },
  { id: "ru", code: "+7", country: "🇷🇺 Rossiya", flag: "🇷🇺" },
  { id: "cn", code: "+86", country: "🇨🇳 China", flag: "🇨🇳" },
  { id: "gb", code: "+44", country: "🇬🇧 United Kingdom", flag: "🇬🇧" },
  { id: "de", code: "+49", country: "🇩🇪 Germany", flag: "🇩🇪" },
  { id: "fr", code: "+33", country: "🇫🇷 France", flag: "🇫🇷" },
  { id: "in", code: "+91", country: "🇮🇳 India", flag: "🇮🇳" },
  { id: "jp", code: "+81", country: "🇯🇵 Japan", flag: "🇯🇵" },
  { id: "kr", code: "+82", country: "🇰🇷 South Korea", flag: "🇰🇷" },
  { id: "tr", code: "+90", country: "🇹🇷 Turkey", flag: "🇹🇷" },
  // Central Asia
  { id: "kg", code: "+996", country: "🇰🇬 Qirg'iziston", flag: "🇰🇬" },
  { id: "tj", code: "+992", country: "🇹🇯 Tojikiston", flag: "🇹🇯" },
  { id: "tm", code: "+993", country: "🇹🇲 Turkmaniston", flag: "🇹🇲" },
  { id: "kz", code: "+77", country: "🇰🇿 Qozog'iston", flag: "🇰🇿" },
  // Additional major countries  
  { id: "ca", code: "+1", country: "🇨🇦 Canada", flag: "🇨🇦", hidden: true }, // Same as US, hide to avoid duplicate
  { id: "au", code: "+61", country: "🇦🇺 Australia", flag: "🇦🇺" },
  { id: "br", code: "+55", country: "🇧🇷 Brazil", flag: "🇧🇷" },
  { id: "mx", code: "+52", country: "🇲🇽 Mexico", flag: "🇲🇽" },
  { id: "it", code: "+39", country: "🇮🇹 Italy", flag: "🇮🇹" },
  { id: "es", code: "+34", country: "🇪🇸 Spain", flag: "🇪🇸" },
  { id: "nl", code: "+31", country: "🇳🇱 Netherlands", flag: "🇳🇱" },
  { id: "se", code: "+46", country: "🇸🇪 Sweden", flag: "🇸🇪" },
  { id: "no", code: "+47", country: "🇳🇴 Norway", flag: "🇳🇴" },
  { id: "dk", code: "+45", country: "🇩🇰 Denmark", flag: "🇩🇰" },
  { id: "pl", code: "+48", country: "🇵🇱 Poland", flag: "🇵🇱" },
  { id: "ua", code: "+380", country: "🇺🇦 Ukraine", flag: "🇺🇦" },
  { id: "eg", code: "+20", country: "🇪🇬 Egypt", flag: "🇪🇬" },
  { id: "sa", code: "+966", country: "🇸🇦 Saudi Arabia", flag: "🇸🇦" },
  { id: "ae", code: "+971", country: "🇦🇪 UAE", flag: "🇦🇪" },
  { id: "pk", code: "+92", country: "🇵🇰 Pakistan", flag: "🇵🇰" },
  { id: "bd", code: "+880", country: "🇧🇩 Bangladesh", flag: "🇧🇩" },
  { id: "id", code: "+62", country: "🇮🇩 Indonesia", flag: "🇮🇩" },
  { id: "th", code: "+66", country: "🇹🇭 Thailand", flag: "🇹🇭" },
  { id: "vn", code: "+84", country: "🇻🇳 Vietnam", flag: "🇻🇳" },
  { id: "ph", code: "+63", country: "🇵🇭 Philippines", flag: "🇵🇭" },
  { id: "my", code: "+60", country: "🇲🇾 Malaysia", flag: "🇲🇾" },
  { id: "sg", code: "+65", country: "🇸🇬 Singapore", flag: "🇸🇬" },
  { id: "za", code: "+27", country: "🇿🇦 South Africa", flag: "🇿🇦" },
  { id: "ng", code: "+234", country: "🇳🇬 Nigeria", flag: "🇳🇬" },
  { id: "ke", code: "+254", country: "🇰🇪 Kenya", flag: "🇰🇪" },
  { id: "ir", code: "+98", country: "🇮🇷 Iran", flag: "🇮🇷" },
  { id: "il", code: "+972", country: "🇮🇱 Israel", flag: "🇮🇱" },
  { id: "af", code: "+93", country: "🇦🇫 Afghanistan", flag: "🇦🇫" },
];

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Initialize country code from user's existing phone number
  const initializeCountryCode = () => {
    if (user?.phoneNumber) {
      const userCode = countryCodes.find(country => user.phoneNumber?.startsWith(country.code));
      return userCode ? userCode.code : "+998";
    }
    return "+998";
  };
  
  const [selectedCountryCode, setSelectedCountryCode] = useState(initializeCountryCode);
  const [usernameValidationMessage, setUsernameValidationMessage] = useState("");
  const [usernameAvailabilityMessage, setUsernameAvailabilityMessage] = useState("");
  const [phoneValidationMessage, setPhoneValidationMessage] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Image editing states
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Phone number validation function with length limiting
  const validatePhoneNumber = useCallback((phoneNumber: string, countryCode: string) => {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '');
    
    if (digits.length === 0) {
      setPhoneValidationMessage("");
      return { isValid: true, limitedPhone: phoneNumber };
    }
    
    const validationRules = {
      "+998": { // Uzbekistan - Comprehensive operator codes
        minLength: 9,
        maxLength: 9,
        pattern: /^[0-9]{9}$/,
        format: "90 123 45 67",
        validStarts: [
          // UMS & Beeline main codes
          "90", "91", "93", "94", "95", "97", "98", "99",
          // Uzmobile codes
          "88", "77", "71", "78",
          // Ucell new codes
          "33", "55",
          // Additional codes
          "50", "20"
        ]
      },
      "+1": { // USA/Canada - Area codes validation
        minLength: 10,
        maxLength: 10,
        pattern: /^[0-9]{10}$/,
        format: "123 456 7890",
        validStarts: [
          // Major city area codes (first 3 digits)
          "201", "202", "203", "205", "206", "207", "208", "209", "210", "212", "213", "214", "215", "216", "217", "218", "219",
          "220", "224", "225", "227", "228", "229", "231", "234", "239", "240", "248", "251", "252", "253", "254", "256", "260",
          "262", "267", "269", "270", "272", "274", "276", "281", "283", "301", "302", "303", "304", "305", "307", "308", "309",
          "310", "312", "313", "314", "315", "316", "317", "318", "319", "320", "321", "323", "325", "330", "331", "334", "336",
          "337", "339", "341", "351", "352", "360", "361", "364", "380", "385", "386", "401", "402", "404", "405", "406", "407",
          "408", "409", "410", "412", "413", "414", "415", "417", "419", "423", "424", "425", "430", "432", "434", "435", "440",
          "442", "443", "458", "463", "464", "469", "470", "475", "478", "479", "480", "484", "501", "502", "503", "504", "505",
          "507", "508", "509", "510", "512", "513", "515", "516", "517", "518", "520", "530", "531", "534", "539", "540", "541",
          "551", "559", "561", "562", "563", "564", "567", "570", "571", "573", "574", "575", "580", "585", "586", "601", "602",
          "603", "605", "606", "607", "608", "609", "610", "612", "614", "615", "616", "617", "618", "619", "620", "623", "626",
          "628", "629", "630", "631", "636", "641", "646", "650", "651", "657", "660", "661", "662", "667", "669", "678", "681",
          "682", "684", "701", "702", "703", "704", "706", "707", "708", "712", "713", "714", "715", "716", "717", "718", "719",
          "720", "724", "727", "731", "732", "734", "737", "740", "743", "747", "754", "757", "760", "762", "763", "765", "769",
          "770", "772", "773", "774", "775", "779", "781", "785", "786", "787", "801", "802", "803", "804", "805", "806", "808",
          "810", "812", "813", "814", "815", "816", "817", "818", "828", "830", "831", "832", "843", "845", "847", "848", "850",
          "856", "857", "858", "859", "860", "862", "863", "864", "865", "870", "872", "878", "901", "903", "904", "906", "907",
          "908", "909", "910", "912", "913", "914", "915", "916", "917", "918", "919", "920", "925", "928", "929", "930", "931",
          "934", "936", "937", "938", "940", "941", "947", "949", "951", "952", "954", "956", "957", "959", "970", "971", "972",
          "973", "978", "979", "980", "984", "985", "989"
        ]
      },
      "+7": { // Russia - Mobile and regional codes
        minLength: 10,
        maxLength: 10,
        pattern: /^[0-9]{10}$/,
        format: "123 456 78 90",
        validStarts: [
          // Mobile operators
          "90", "91", "92", "93", "94", "95", "96", "97", "98", "99",
          // Additional mobile codes
          "80", "81", "82", "83", "84", "85", "86", "87", "88", "89",
          // Regional codes
          "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
          "40", "41", "42", "43", "44", "45", "46", "47", "48", "49",
          "50", "51", "52", "53", "54", "55", "56", "57", "58", "59"
        ]
      },
      "+44": { // UK - Mobile and geographic codes
        minLength: 10,
        maxLength: 11,
        pattern: /^[0-9]{10,11}$/,
        format: "20 1234 5678",
        validStarts: [
          // Mobile operators (07)
          "70", "71", "72", "73", "74", "75", "76", "77", "78", "79",
          // London (020)
          "20",
          // Geographic codes
          "11", "12", "13", "14", "15", "16", "17", "18", "19"
        ]
      },
      "+49": { // Germany - Mobile and city codes
        minLength: 10,
        maxLength: 12,
        pattern: /^[0-9]{10,12}$/,
        format: "30 12345678",
        validStarts: [
          // Mobile operators
          "15", "16", "17",
          // Major cities
          "30", // Berlin
          "40", // Hamburg
          "69", // Frankfurt
          "89", // Munich
          // Other area codes
          "20", "21", "22", "23", "24", "25", "26", "27", "28", "29",
          "32", "33", "34", "35", "36", "37", "38", "39",
          "41", "42", "43", "44", "45", "46", "47", "48", "49",
          "50", "51", "52", "53", "54", "55", "56", "57", "58", "59"
        ]
      },
      "+33": { // France - Mobile and geographic
        minLength: 9,
        maxLength: 9,
        pattern: /^[0-9]{9}$/,
        format: "1 23 45 67 89",
        validStarts: [
          // Mobile operators
          "6", "7",
          // Geographic regions
          "1", // Île-de-France (Paris)
          "2", // Northwest France
          "3", // Northeast France  
          "4", // Southeast France
          "5"  // Southwest France
        ]
      },
      "+81": { // Japan - Mobile and city codes
        minLength: 10,
        maxLength: 11,
        pattern: /^[0-9]{10,11}$/,
        format: "90 1234 5678",
        validStarts: [
          // Mobile operators
          "70", "80", "90",
          // Tokyo area
          "3",
          // Osaka area
          "6",
          // Other major cities
          "11", "22", "25", "45", "52", "72", "75", "92", "95", "98"
        ]
      },
      "+91": { // India - All mobile operator codes
        minLength: 10,
        maxLength: 10,
        pattern: /^[0-9]{10}$/,
        format: "98765 43210",
        validStarts: [
          // All mobile operator codes (comprehensive)
          "70", "71", "72", "73", "74", "75", "76", "77", "78", "79",
          "80", "81", "82", "83", "84", "85", "86", "87", "88", "89",
          "90", "91", "92", "93", "94", "95", "96", "97", "98", "99"
        ]
      },
      "+82": { // South Korea - Mobile and city codes
        minLength: 9,
        maxLength: 10,
        pattern: /^[0-9]{9,10}$/,
        format: "10 1234 5678",
        validStarts: [
          // Mobile operators
          "10", "11", "16", "17", "18", "19",
          // Seoul
          "2",
          // Busan
          "51",
          // Other cities
          "31", "32", "33", "41", "42", "43", "53", "54", "55", "61", "62", "63", "64"
        ]
      },
      "+90": { // Turkey - Mobile and city codes
        minLength: 10,
        maxLength: 10,
        pattern: /^[0-9]{10}$/,
        format: "532 123 4567",
        validStarts: [
          // Mobile operators
          "50", "51", "52", "53", "54", "55", "56", "57", "58", "59",
          // Istanbul European side
          "212",
          // Istanbul Asian side
          "216",
          // Ankara
          "312",
          // Izmir
          "232"
        ]
      }
    };
    
    const rules = validationRules[countryCode as keyof typeof validationRules];
    let maxLength = 15; // Default for generic countries
    let minLength = 7;
    
    if (rules) {
      maxLength = rules.maxLength;
      minLength = rules.minLength;
    }
    
    // Limit input to maximum allowed length
    let limitedDigits = digits;
    if (digits.length > maxLength) {
      limitedDigits = digits.substring(0, maxLength);
      setPhoneValidationMessage(`⚠️ Maksimal ${maxLength} ta raqam ruxsat etilgan`);
      return { isValid: false, limitedPhone: limitedDigits };
    }
    
    // Show progress counter when approaching limit
    if (limitedDigits.length >= maxLength - 2 && limitedDigits.length < maxLength) {
      const remaining = maxLength - limitedDigits.length;
      setPhoneValidationMessage(`📊 ${limitedDigits.length}/${maxLength} - ${remaining} ta raqam qoldi`);
      return { isValid: false, limitedPhone: limitedDigits };
    }
    
    if (!rules) {
      // Generic validation for other countries
      if (limitedDigits.length < minLength) {
        setPhoneValidationMessage(`📊 ${limitedDigits.length}/${maxLength} - Kamida ${minLength} ta raqam kerak`);
        return { isValid: false, limitedPhone: limitedDigits };
      }
      setPhoneValidationMessage(`✅ To'g'ri telefon raqam (${limitedDigits.length}/${maxLength})`);
      return { isValid: true, limitedPhone: limitedDigits };
    }
    
    let errorMessages = [];
    
    // Check length
    if (limitedDigits.length < rules.minLength) {
      errorMessages.push(`${limitedDigits.length}/${rules.maxLength} - Kamida ${rules.minLength} ta raqam kerak`);
    }
    
    // Check valid starts for different countries
    if (rules.validStarts && limitedDigits.length >= 2) {
      let start = "";
      let errorMessage = "";
      
      if (countryCode === "+998") {
        // Uzbekistan: 2-digit operator codes
        start = limitedDigits.substring(0, 2);
        errorMessage = `O'zbekiston raqami ${rules.validStarts.slice(0, 8).join(', ')}... bilan boshlanishi kerak`;
      } else if (countryCode === "+1") {
        // USA/Canada: 3-digit area codes
        if (limitedDigits.length >= 3) {
          start = limitedDigits.substring(0, 3);
          errorMessage = "AQSH/Kanada uchun to'g'ri area code kiritilmagan";
        }
      } else if (countryCode === "+7") {
        // Russia: 2-digit codes
        start = limitedDigits.substring(0, 2);
        errorMessage = "Rossiya raqami to'g'ri operator kod bilan boshlanishi kerak";
      } else if (countryCode === "+44") {
        // UK: 2-digit codes
        start = limitedDigits.substring(0, 2);
        errorMessage = "Angliya raqami to'g'ri kod bilan boshlanishi kerak";
      } else if (countryCode === "+49") {
        // Germany: 2-digit codes
        start = limitedDigits.substring(0, 2);
        errorMessage = "Germaniya raqami to'g'ri kod bilan boshlanishi kerak";
      } else if (countryCode === "+33") {
        // France: 1-digit codes
        start = limitedDigits.substring(0, 1);
        errorMessage = "Fransiya raqami 1-5, 6-7 raqamlari bilan boshlanishi kerak";
      } else if (countryCode === "+81") {
        // Japan: 1 or 2-digit codes
        start = limitedDigits.substring(0, limitedDigits.length >= 2 ? 2 : 1);
        errorMessage = "Yaponiya raqami to'g'ri kod bilan boshlanishi kerak";
      } else if (countryCode === "+91") {
        // India: 2-digit codes
        start = limitedDigits.substring(0, 2);
        errorMessage = "Hindiston raqami 70-99 oralig'ida boshlanishi kerak";
      } else if (countryCode === "+82") {
        // South Korea: 1 or 2-digit codes
        start = limitedDigits.substring(0, limitedDigits.length >= 2 ? 2 : 1);
        errorMessage = "Janubiy Koreya raqami to'g'ri kod bilan boshlanishi kerak";
      } else if (countryCode === "+90") {
        // Turkey: 2 or 3-digit codes
        start = limitedDigits.substring(0, limitedDigits.length >= 3 ? 3 : 2);
        errorMessage = "Turkiya raqami to'g'ri kod bilan boshlanishi kerak";
      }
      
      if (start && !rules.validStarts.includes(start)) {
        errorMessages.push(errorMessage);
      }
    }
    
    if (errorMessages.length > 0) {
      setPhoneValidationMessage(`⚠️ ${errorMessages.join(', ')}`);
      return { isValid: false, limitedPhone: limitedDigits };
    }
    
    // Success message with counter
    setPhoneValidationMessage(`✅ To'g'ri telefon raqam (${limitedDigits.length}/${rules.maxLength})`);
    return { isValid: true, limitedPhone: limitedDigits };
  }, []);

  // Debounced username availability check
  const checkUsernameAvailability = useCallback(
    async (username: string) => {
      if (username.length < 3) {
        setUsernameAvailabilityMessage("");
        return;
      }

      // Remove @ symbol for API call
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
      
      if (cleanUsername.length < 3) {
        setUsernameAvailabilityMessage("");
        return;
      }

      try {
        const response = await fetch(`/api/auth/check-username/${cleanUsername}`, {
          headers: getAuthHeaders(),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.available) {
            setUsernameAvailabilityMessage("✅ Username mavjud");
          } else {
            setUsernameAvailabilityMessage("❌ Username band qilingan");
          }
        }
      } catch (error) {
        console.error("Username check failed:", error);
        setUsernameAvailabilityMessage("");
      }
    },
    []
  );

  // Handle image file selection
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Fayl juda katta",
          description: "Rasm hajmi 5MB dan oshmasligi kerak",
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Noto'g'ri fayl turi",
          description: "Faqat rasm fayllari ruxsat etilgan",
          variant: "destructive",
        });
        return;
      }

      setSelectedImage(file);
      
      // Create preview and start editing
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setOriginalImage(result);
        setImagePreview(result);
        setIsEditingImage(true);
        
        // Reset editing states
        setImageScale(1);
        setImagePosition({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear selected image
  const handleClearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setOriginalImage(null);
    setIsEditingImage(false);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Image editing functions
  const drawImageOnCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = new Image();
    if (!canvas || !originalImage) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    img.onload = () => {
      const size = 300; // Canvas size for editing
      canvas.width = size;
      canvas.height = size;
      
      // Clear canvas
      ctx.clearRect(0, 0, size, size);
      
      // Calculate image dimensions
      const imgAspect = img.width / img.height;
      let imgWidth = size * imageScale;
      let imgHeight = size * imageScale;
      
      if (imgAspect > 1) {
        imgHeight = imgWidth / imgAspect;
      } else {
        imgWidth = imgHeight * imgAspect;
      }
      
      // Draw image with current position and scale
      const x = (size / 2) + imagePosition.x - (imgWidth / 2);
      const y = (size / 2) + imagePosition.y - (imgHeight / 2);
      
      ctx.drawImage(img, x, y, imgWidth, imgHeight);
      
      // Draw circle overlay for cropping preview
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    };
    
    img.src = originalImage;
  }, [originalImage, imageScale, imagePosition]);

  // Generate final cropped image
  const generateCroppedImage = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      if (!ctx || !originalImage) return;
      
      img.onload = () => {
        const finalSize = 200; // Final avatar size
        canvas.width = finalSize;
        canvas.height = finalSize;
        
        // Calculate scaled dimensions
        const imgAspect = img.width / img.height;
        let imgWidth = finalSize * imageScale;
        let imgHeight = finalSize * imageScale;
        
        if (imgAspect > 1) {
          imgHeight = imgWidth / imgAspect;
        } else {
          imgWidth = imgHeight * imgAspect;
        }
        
        // Draw and crop
        const x = (finalSize / 2) + (imagePosition.x * finalSize / 300) - (imgWidth / 2);
        const y = (finalSize / 2) + (imagePosition.y * finalSize / 300) - (imgHeight / 2);
        
        ctx.drawImage(img, x, y, imgWidth, imgHeight);
        
        // Create circular mask
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.arc(finalSize / 2, finalSize / 2, finalSize / 2, 0, 2 * Math.PI);
        ctx.fill();
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/jpeg', 0.9);
      };
      
      img.src = originalImage;
    });
  }, [originalImage, imageScale, imagePosition]);

  // Image editing event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setImagePosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setImageScale(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setImageScale(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleSaveEditedImage = async () => {
    try {
      const croppedBlob = await generateCroppedImage();
      const croppedFile = new File([croppedBlob], selectedImage?.name || 'avatar.jpg', {
        type: 'image/jpeg'
      });
      
      // Create URL for preview
      const previewUrl = URL.createObjectURL(croppedBlob);
      
      // Update states
      setSelectedImage(croppedFile);
      setImagePreview(previewUrl);
      setIsEditingImage(false);
      
      // Upload image to server immediately and update user avatar
      try {
        const formData = new FormData();
        formData.append('avatar', croppedFile);
        
        const response = await fetch('/api/profile/avatar', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            // Don't set Content-Type - let browser set it automatically for FormData
          },
          body: formData
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            
            // Add cache-busting parameter to prevent browser caching issues
            const avatarUrlWithCacheBust = `${data.profileImageUrl}?t=${Date.now()}`;
            
            // Update profile form with new avatar URL
            profileForm.setValue('profileImageUrl', avatarUrlWithCacheBust);
            
            // Force refresh the user data immediately to show new avatar everywhere
            queryClient.setQueryData(["/api/auth/me"], (oldData: any) => {
              if (oldData) {
                return {
                  ...oldData,
                  profileImageUrl: avatarUrlWithCacheBust
                };
              }
              return oldData;
            });
            
            // Also refresh user data to ensure server sync
            await refreshUser();
            
            toast({
              title: "Avatar yangilandi! ✅",
              description: "Rasm muvaffaqiyatli yuklandi va profil avatari yangilandi"
            });
          } else {
            // Server returned HTML or non-JSON response
            const responseText = await response.text();
            console.error('Non-JSON response:', responseText);
            throw new Error('Server returned invalid response format');
          }
        } else {
          const errorText = await response.text();
          console.error('Upload failed with status:', response.status, errorText);
          throw new Error(`Upload failed: ${response.status}`);
        }
      } catch (uploadError) {
        console.error('Avatar upload failed:', uploadError);
        // Still update form with local preview URL as fallback
        profileForm.setValue('profileImageUrl', previewUrl);
        
        toast({
          title: "Avatar tahrirlandi! ✅",
          description: "Avatar local ravishda yangilandi. Internet ulanishi tekshiring."
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Xatolik",
        description: "Rasmni tayyorlashda xatolik yuz berdi"
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditingImage(false);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Draw image on canvas when editing
  useEffect(() => {
    if (isEditingImage && originalImage) {
      drawImageOnCanvas();
    }
  }, [isEditingImage, originalImage, imageScale, imagePosition, drawImageOnCanvas]);

  const profileForm = useForm<UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
      displayUsername: user?.displayUsername || "",
      profileImageUrl: user?.profileImageUrl || "",
    },
  });

  const passwordForm = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }

      return response.json();
    },
    onSuccess: (updatedUser) => {
      toast({
        title: "Success",
        description: "Profile updated successfully!",
      });
      refreshUser();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      const response = await fetch("/api/profile/password", {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to change password");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password changed successfully!",
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      profileForm.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        displayUsername: user.displayUsername || "",
        profileImageUrl: user.profileImageUrl || "",
      });
      
      // Update selected country code from phone number
      if (user.phoneNumber) {
        const userCode = countryCodes.find(country => user.phoneNumber?.startsWith(country.code));
        if (userCode) {
          setSelectedCountryCode(userCode.code);
        }
      }
    }
  }, [user, profileForm]);

  const handleProfileUpdate = (data: UpdateProfileData) => {
    updateProfileMutation.mutate(data);
  };

  const handlePasswordChange = (data: ChangePasswordData) => {
    changePasswordMutation.mutate(data);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-muted/50 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold">Profile Settings</h1>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Update your personal details and profile information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile Picture Section */}
                <div className="flex items-center space-x-6">
                  <Avatar 
                    className="h-24 w-24 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                      {user?.username?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium text-lg" data-testid="profile-display-name">
                      {user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}`
                        : user?.username
                      }
                    </h3>
                    <p className="text-muted-foreground" data-testid="profile-username">
                      {user?.displayUsername || `@${user?.username}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      📱 {user?.phoneNumber || "Telefon qo'shilmagan"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      🎂 {user?.birthDate || "Tug'ilgan sana kiritilmagan"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Joined {user?.createdAt && formatDate(user.createdAt.toString())}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Profile Form */}
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="John"
                                {...field}
                                data-testid="input-first-name"
                                className="h-12 text-base"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={profileForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Doe"
                                {...field}
                                className="h-12 text-base"
                                data-testid="input-last-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="john@example.com"
                              {...field}
                              data-testid="input-email"
                              className="h-12 text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>📱 Telefon raqam</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Select 
                                  value={selectedCountryCode} 
                                  onValueChange={(newCountryCode) => {
                                    setSelectedCountryCode(newCountryCode);
                                    
                                    // Get current phone number without country code
                                    const currentValue = field.value || '';
                                    const currentPhoneOnly = currentValue.replace(new RegExp(`^${selectedCountryCode.replace('+', '\\+')}\\s*`), '').trim();
                                    
                                    // Validate with new country code
                                    if (currentPhoneOnly) {
                                      const validationResult = validatePhoneNumber(currentPhoneOnly.replace(/\D/g, ''), newCountryCode);
                                      // Use limited phone if validation cuts it
                                      const limitedPhone = validationResult.limitedPhone;
                                      if (limitedPhone !== currentPhoneOnly.replace(/\D/g, '')) {
                                        // Re-format if phone was limited
                                        const formattedLimited = limitedPhone;
                                        const newFullNumber = formattedLimited ? `${newCountryCode} ${formattedLimited}` : newCountryCode;
                                        field.onChange(newFullNumber);
                                        return;
                                      }
                                    }
                                    
                                    // Update with new country code
                                    const newFullNumber = currentPhoneOnly ? `${newCountryCode} ${currentPhoneOnly}` : newCountryCode;
                                    field.onChange(newFullNumber);
                                  }}
                                >
                                  <SelectTrigger className="w-40 h-12">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {countryCodes.filter(country => !country.hidden).map((country) => (
                                      <SelectItem key={country.id} value={country.code}>
                                        <div className="flex items-center gap-2">
                                          <span>{country.flag}</span>
                                          <span>{country.code}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="tel"
                                  placeholder={
                                    selectedCountryCode === "+998" ? "90 123 45 67" :
                                    selectedCountryCode === "+1" ? "123 456 7890" :
                                    selectedCountryCode === "+7" ? "123 456 78 90" :
                                    selectedCountryCode === "+44" ? "20 1234 5678" :
                                    selectedCountryCode === "+49" ? "30 12345678" :
                                    selectedCountryCode === "+33" ? "1 23 45 67 89" :
                                    "Phone number"
                                  }
                                  {...field}
                                  data-testid="input-phone-number"
                                  className="h-12 text-base flex-1"
                                  onChange={(e) => {
                                    // Format phone number and combine with country code
                                    const phoneNumber = e.target.value.replace(/\D/g, '');
                                    
                                    // Validate phone number and get limited version
                                    const validationResult = validatePhoneNumber(phoneNumber, selectedCountryCode);
                                    let formattedPhone = validationResult.limitedPhone;
                                    
                                    // Different formatting for different countries
                                    if (formattedPhone.length > 0) {
                                      switch (selectedCountryCode) {
                                        case "+998": // Uzbekistan (90 123 45 67)
                                          if (formattedPhone.length <= 9) {
                                            formattedPhone = formattedPhone.replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2})/, (match, p1, p2, p3, p4) => {
                                              let result = p1;
                                              if (p2) result += ' ' + p2;
                                              if (p3) result += ' ' + p3;
                                              if (p4) result += ' ' + p4;
                                              return result;
                                            });
                                          }
                                          break;
                                        case "+1": // USA/Canada (123) 456-7890
                                          if (formattedPhone.length <= 10) {
                                            formattedPhone = formattedPhone.replace(/(\d{3})(\d{0,3})(\d{0,4})/, (match, p1, p2, p3) => {
                                              let result = p1;
                                              if (p2) result += ' ' + p2;
                                              if (p3) result += ' ' + p3;
                                              return result;
                                            });
                                          }
                                          break;
                                        case "+7": // Russia (123) 456-78-90
                                          if (formattedPhone.length <= 10) {
                                            formattedPhone = formattedPhone.replace(/(\d{3})(\d{0,3})(\d{0,2})(\d{0,2})/, (match, p1, p2, p3, p4) => {
                                              let result = p1;
                                              if (p2) result += ' ' + p2;
                                              if (p3) result += ' ' + p3;
                                              if (p4) result += ' ' + p4;
                                              return result;
                                            });
                                          }
                                          break;
                                        default:
                                          // Generic formatting for other countries
                                          if (formattedPhone.length <= 12) {
                                            formattedPhone = formattedPhone.replace(/(\d{1,3})(\d{0,3})(\d{0,3})(\d{0,3})/, (match, p1, p2, p3, p4) => {
                                              let result = p1;
                                              if (p2) result += ' ' + p2;
                                              if (p3) result += ' ' + p3;
                                              if (p4) result += ' ' + p4;
                                              return result;
                                            });
                                          }
                                      }
                                    }
                                    
                                    const fullNumber = formattedPhone ? `${selectedCountryCode} ${formattedPhone}` : selectedCountryCode;
                                    field.onChange(fullNumber);
                                  }}
                                  value={field.value?.replace(new RegExp(`^${selectedCountryCode.replace('+', '\\+')}`), '').trim() || ''}
                                />
                              </div>
                            </FormControl>
                            {phoneValidationMessage && (
                              <div className={`text-sm mt-1 ${
                                phoneValidationMessage.includes('✅') 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}>
                                {phoneValidationMessage}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={profileForm.control}
                        name="displayUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>👤 @Username</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="@johndoe"
                                {...field}
                                data-testid="input-display-username"
                                className="h-12 text-base"
                                onChange={(e) => {
                                  let value = e.target.value;
                                  let originalInput = value.startsWith('@') ? value.slice(1) : value;
                                  
                                  // Remove @ prefix temporarily for filtering
                                  let username = value.startsWith('@') ? value.slice(1) : value;
                                  
                                  // Check for invalid characters and provide feedback
                                  const invalidChars = originalInput.match(/[^a-zA-Z0-9_]/g);
                                  const startsWithNumber = /^[0-9]/.test(originalInput);
                                  const startsWithUnderscore = /^_/.test(originalInput);
                                  const hasConsecutiveUnderscores = /__+/.test(originalInput);
                                  const endsWithUnderscore = /_$/.test(originalInput) && originalInput.length > 1;
                                  const tooShort = originalInput.length > 0 && originalInput.length < 5;
                                  const tooLong = originalInput.length > 32;
                                  
                                  let validationMessages = [];
                                  
                                  if (tooShort) {
                                    validationMessages.push("Kamida 5 ta belgi bo'lishi kerak");
                                  }
                                  
                                  if (tooLong) {
                                    validationMessages.push("Ko'pi bilan 32 ta belgi bo'lishi mumkin");
                                  }
                                  
                                  if (invalidChars && invalidChars.length > 0) {
                                    const uniqueInvalidChars = Array.from(new Set(invalidChars)).join(', ');
                                    validationMessages.push(`"${uniqueInvalidChars}" belgilar ishlatilmaydi`);
                                  }
                                  
                                  if (startsWithNumber) {
                                    validationMessages.push("Harf bilan boshlanishi kerak");
                                  }
                                  
                                  if (startsWithUnderscore) {
                                    validationMessages.push("Pastki chiziq bilan boshlanmasligi kerak");
                                  }
                                  
                                  if (hasConsecutiveUnderscores) {
                                    validationMessages.push("Ketma-ket pastki chiziq ishlatilmaydi");
                                  }
                                  
                                  if (endsWithUnderscore) {
                                    validationMessages.push("Pastki chiziq bilan tugamasligi kerak");
                                  }
                                  
                                  // Set validation message
                                  if (validationMessages.length > 0) {
                                    setUsernameValidationMessage(`⚠️ ${validationMessages.join(', ')}`);
                                    setUsernameAvailabilityMessage(""); // Clear availability check during validation errors
                                    
                                    // Clear any pending availability check timeout
                                    if (timeoutRef.current) {
                                      clearTimeout(timeoutRef.current);
                                      timeoutRef.current = null;
                                    }
                                  } else {
                                    setUsernameValidationMessage("");
                                    
                                    // Clear previous timeout
                                    if (timeoutRef.current) {
                                      clearTimeout(timeoutRef.current);
                                    }
                                    
                                    // Check username availability after a delay (debouncing)
                                    timeoutRef.current = setTimeout(() => {
                                      if (finalValue && finalValue.length >= 6) { // @username = 5 chars + @ = 6 total
                                        checkUsernameAvailability(finalValue);
                                      }
                                    }, 500); // 500ms debounce
                                  }
                                  
                                  // Apply username validation rules
                                  // Remove all characters that are not letters, numbers, or underscores
                                  username = username.replace(/[^a-zA-Z0-9_]/g, '');
                                  
                                  // If it starts with a number or underscore, remove all leading numbers and underscores
                                  username = username.replace(/^[0-9_]+/, '');
                                  
                                  // Prevent consecutive underscores by replacing multiple underscores with single one
                                  username = username.replace(/_+/g, '_');
                                  
                                  // Add @ prefix back
                                  const finalValue = username.length > 0 ? '@' + username : '';
                                  field.onChange(finalValue);
                                }}
                              />
                            </FormControl>
                            {usernameValidationMessage && (
                              <div className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                {usernameValidationMessage}
                              </div>
                            )}
                            {usernameAvailabilityMessage && (
                              <div className={`text-sm mt-1 ${
                                usernameAvailabilityMessage.includes('✅') 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {usernameAvailabilityMessage}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Hidden file input for avatar upload */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      className="hidden"
                      data-testid="file-input-profile-image"
                    />
                    
                    {selectedImage && (
                      <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        ✅ {selectedImage.name} tanlandi - Avatar ustiga bosib o'zgartiring
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-update-profile"
                      className="h-12 text-base"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lock className="h-5 w-5 mr-2" />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter current password"
                              {...field}
                              data-testid="input-current-password"
                              className="h-12 text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter new password"
                              {...field}
                              data-testid="input-new-password"
                              className="h-12 text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Confirm new password"
                              {...field}
                              data-testid="input-confirm-password"
                              className="h-12 text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                      data-testid="button-change-password"
                      className="h-12 text-base"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Image Editing Dialog */}
      <Dialog open={isEditingImage} onOpenChange={setIsEditingImage}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              📸 Rasmni tahrirlash
            </DialogTitle>
            <DialogDescription>
              Rasmni avatar uchun moslashtiring. Sichqoncha bilan tortib, zoom tugmalari bilan kattalashtiring.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Canvas for image editing */}
            <div className="flex justify-center">
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={300}
                  className="border-2 border-dashed border-gray-300 rounded-full cursor-move"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
                <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                  {Math.round(imageScale * 100)}%
                </div>
              </div>
            </div>

            {/* Editing Controls */}
            <div className="flex justify-center items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={imageScale <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              
              <div className="text-sm text-muted-foreground min-w-16 text-center">
                {Math.round(imageScale * 100)}%
              </div>
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={imageScale >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setImageScale(1);
                  setImagePosition({ x: 0, y: 0 });
                }}
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              💡 <strong>Maslahat:</strong> Rasmni sichqoncha bilan tortib, o'rnini o'zgaritiring. Zoom tugmalari bilan kattalashtiring.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEdit}
            >
              <X className="h-4 w-4 mr-2" />
              Bekor qilish
            </Button>
            <Button
              type="button"
              onClick={handleSaveEditedImage}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}