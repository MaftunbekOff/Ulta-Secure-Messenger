import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Settings, Camera, Save, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getAuthHeaders } from "@/lib/authUtils";
import { updateProfileSchema, changePasswordSchema, type UpdateProfileData, type ChangePasswordData } from "@shared/schema";
import { useLocation } from "wouter";

// Country codes data
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
  { id: "kg", code: "+996", country: "🇰🇬 Qirg'iziston", flag: "🇰🇬" },
  { id: "tj", code: "+992", country: "🇹🇯 Tojikiston", flag: "🇹🇯" },
  { id: "tm", code: "+993", country: "🇹🇲 Turkmaniston", flag: "🇹🇲" },
  { id: "kz", code: "+77", country: "🇰🇿 Qozog'iston", flag: "🇰🇿" },
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
                  <Avatar className="h-24 w-24">
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
                                <Select value={selectedCountryCode} onValueChange={setSelectedCountryCode}>
                                  <SelectTrigger className="w-40 h-12">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {countryCodes.map((country) => (
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
                                  placeholder="90 123 45 67"
                                  {...field}
                                  data-testid="input-phone-number"
                                  className="h-12 text-base flex-1"
                                  onChange={(e) => {
                                    // Format phone number and combine with country code
                                    const phoneNumber = e.target.value.replace(/\D/g, '');
                                    let formattedPhone = phoneNumber;
                                    
                                    // Format for Uzbekistan style (90 123 45 67)
                                    if (phoneNumber.length >= 2 && phoneNumber.length <= 9) {
                                      formattedPhone = phoneNumber.replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2})/, (match, p1, p2, p3, p4) => {
                                        let result = p1;
                                        if (p2) result += ' ' + p2;
                                        if (p3) result += ' ' + p3;
                                        if (p4) result += ' ' + p4;
                                        return result;
                                      });
                                    }
                                    
                                    const fullNumber = formattedPhone ? `${selectedCountryCode} ${formattedPhone}` : selectedCountryCode;
                                    field.onChange(fullNumber);
                                  }}
                                  value={field.value?.replace(new RegExp(`^${selectedCountryCode.replace('+', '\\+')}`), '').trim() || ''}
                                />
                              </div>
                            </FormControl>
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
                                  
                                  let validationMessages = [];
                                  
                                  if (invalidChars && invalidChars.length > 0) {
                                    const uniqueInvalidChars = [...new Set(invalidChars)].join(', ');
                                    validationMessages.push(`"${uniqueInvalidChars}" belgilar ishlatilmaydi`);
                                  }
                                  
                                  if (startsWithNumber) {
                                    validationMessages.push("Raqam bilan boshlanmasligi kerak");
                                  }
                                  
                                  if (startsWithUnderscore) {
                                    validationMessages.push("Pastki chiziq bilan boshlanmasligi kerak");
                                  }
                                  
                                  if (hasConsecutiveUnderscores) {
                                    validationMessages.push("Ketma-ket pastki chiziq ishlatilmaydi");
                                  }
                                  
                                  // Set validation message
                                  if (validationMessages.length > 0) {
                                    setUsernameValidationMessage(`⚠️ ${validationMessages.join(', ')}`);
                                  } else {
                                    setUsernameValidationMessage("");
                                  }
                                  
                                  // Apply username validation rules
                                  // Remove all characters that are not letters, numbers, or underscores
                                  username = username.replace(/[^a-zA-Z0-9_]/g, '');
                                  
                                  // If it starts with a number or underscore, remove all leading numbers and underscores
                                  username = username.replace(/^[0-9_]+/, '');
                                  
                                  // Prevent consecutive underscores by replacing multiple underscores with single one
                                  username = username.replace(/_+/g, '_');
                                  
                                  // Remove trailing underscore only if the input doesn't end with a single underscore
                                  // This allows users to type underscores normally
                                  if (username.endsWith('_') && !value.endsWith('_')) {
                                    username = username.replace(/_$/, '');
                                  }
                                  
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={profileForm.control}
                      name="profileImageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profile Image URL</FormLabel>
                          <FormControl>
                            <Input
                              type="url"
                              placeholder="https://example.com/avatar.jpg"
                              {...field}
                              data-testid="input-profile-image"
                              className="h-12 text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
    </div>
  );
}