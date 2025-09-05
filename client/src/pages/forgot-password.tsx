import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { Shield, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { forgotPasswordSchema, type ForgotPasswordData } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function ForgotPassword() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleSubmit = async (data: ForgotPasswordData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest(`/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setIsSubmitted(true);
        const result = await response.json();
        
        toast({
          title: "✅ Muvaffaqiyat",
          description: result.message,
        });

        // Development only - show reset token in console
        if (result.resetToken) {
          console.log("🔑 Reset token:", result.resetToken);
          toast({
            title: "🔧 Development Mode",
            description: `Reset token: ${result.resetToken}`,
            variant: "default",
          });
        }
      } else {
        const error = await response.json();
        toast({
          title: "❌ Xatolik",
          description: error.message || "Parolni tiklashda xatolik yuz berdi",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Xatolik", 
        description: "Server bilan bog'lanishda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4 sm:p-6 md:p-8">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 text-2xl font-bold mx-auto mb-4">
              <Mail />
            </div>
            <CardTitle className="text-2xl">📧 Email yuborildi</CardTitle>
            <CardDescription>
              Parolni tiklash ko'rsatmalari email manzilingizga yuborildi. 
              Email qutingizni tekshiring va ko'rsatmalarga amal qiling.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              Email kelmagan bo'lsa, spam qutisini ham tekshiring
            </div>
            
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Loginlqa qaytish
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-2xl font-bold mx-auto mb-4">
            <Shield />
          </div>
          <CardTitle className="text-2xl">🔑 Parolni tiklash</CardTitle>
          <CardDescription>
            Email manzilingizni kiriting. Sizga parolni tiklash uchun ko'rsatmalar yuboramiz.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>📧 Email manzil</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        {...field}
                        data-testid="input-forgot-email"
                        className="h-12 text-base"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                size="lg"
                className="w-full h-12 text-base"
                disabled={isLoading}
                data-testid="button-forgot-password"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Yuborilmoqda...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Tiklash ko'rsatmasini yuborish
                  </>
                )}
              </Button>

              <div className="text-center">
                <Link href="/login">
                  <Button
                    variant="link"
                    className="text-sm"
                    data-testid="link-back-to-login"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Loginiga qaytish
                  </Button>
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}