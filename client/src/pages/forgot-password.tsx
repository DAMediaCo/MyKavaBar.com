import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Phone } from "lucide-react";
import { Link, useLocation } from "wouter";

const formSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, "Please enter a valid phone number")
    .regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number"),
  verificationCode: z
    .string()
    .min(4, "Please enter the 4-digit code")
    .max(4, "Please enter the 4-digit code")
    .optional(),
});

const verificationSchema = z.object({
  phoneNumber: z.string(),
  verificationCode: z
    .string()
    .min(4, "Please enter the 4-digit code")
    .max(4, "Please enter the 4-digit code"),
});

type FormData = z.infer<typeof formSchema>;
type VerificationData = z.infer<typeof verificationSchema>;

export default function ForgotPassword() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [, navigate] = useLocation();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phoneNumber: "",
    },
  });

  const verificationForm = useForm<VerificationData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      phoneNumber: "",
      verificationCode: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to request password reset");
      }

      setShowVerification(true);
      verificationForm.setValue("phoneNumber", data.phoneNumber);

      toast({
        title: "Check your phone",
        description:
          "If an account exists with this phone number, you will receive a verification code.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.message ||
          "Failed to request password reset. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onVerify = async (data: VerificationData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: form.getValues("phoneNumber"),
          code: data.verificationCode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to verify code");
      }

      // Redirect to reset password page with the token
      navigate(`/reset-password/${result.token}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.message || "Failed to verify code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-md mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Phone className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-center">Forgot Password</CardTitle>
          <CardDescription className="text-center">
            {showVerification
              ? "Enter the verification code sent to your phone."
              : "Enter your phone number to receive a verification code."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showVerification ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {showVerification && (
                  <FormField
                    control={form.control}
                    name="verificationCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter 4-digit code"
                            {...field}
                            type="text"
                            maxLength={4}
                            inputMode="numeric"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="1234567890"
                          {...field}
                          type="tel"
                          value={field.value}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            field.onChange(value ? `${value}` : "");
                          }}
                        />
                      </FormControl>
                      <FormDescription>U.S. numbers only (+1)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send Verification Code"}
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...verificationForm}>
              <form
                onSubmit={verificationForm.handleSubmit(onVerify)}
                className="space-y-4"
              >
                <FormField
                  control={verificationForm.control}
                  name="verificationCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verification Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter 4-digit code"
                          {...field}
                          type="text"
                          maxLength={4}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="one-time-code"
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the 4-digit code sent to your phone
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Verify Code"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowVerification(false);
                    form.reset();
                    verificationForm.reset();
                  }}
                >
                  Try Different Number
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center gap-2">
          <Link href="/auth">
            <Button variant="link">Back to Login</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
