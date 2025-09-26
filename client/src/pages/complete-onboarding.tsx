"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const usernameSchema = z.object({
  username: z
    .string()
    .min(3, "Must be at least 3 characters")
    .max(20, "Max 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  phoneNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[0-9]{7,15}$/.test(val), {
      message: "Invalid phone number format",
    }),
});

type OnboardingFormValues = z.infer<typeof usernameSchema>;

const CompleteOnboarding: React.FC = () => {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(usernameSchema),
  });

  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);

  const currentUsername = watch("username");

  useEffect(() => {
    const loadSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const response = await fetch("/api/auth/username-suggestions", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch username suggestions");
        }
        const data = await response.json();
        setSuggestions(data.suggestions);
      } catch (error) {
        console.error("Error fetching username suggestions:", error);
        toast({
          title: "Error",
          description: "Could not load username suggestions",
          variant: "destructive",
        });
      } finally {
        setLoadingSuggestions(false);
      }
    };
    loadSuggestions();
  }, [setValue, toast]);

  const onSuggestionClick = (username: string) => {
    setValue("username", username, { shouldValidate: true });
  };

  const onSubmit = (data: OnboardingFormValues) => {
    toast({
      title: "Onboarding Complete",
      description: `Welcome, ${data.username}!`,
    });
    // Submit onboarding data to your API here...
  };

  return (
    <main className="max-w-md mx-auto p-6">
      <div className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 text-center shadow-sm font-medium">
        To access the site, please complete your onboarding process.
      </div>
      <h1 className="text-2xl font-semibold mb-6">Complete Your Onboarding</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <Label htmlFor="username">Choose a Username *</Label>
          <Input
            id="username"
            {...register("username")}
            className="mt-1"
            autoComplete="off"
          />
          {loadingSuggestions && (
            <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
              <svg
                className="animate-spin h-4 w-4 text-gray-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
              <span>Suggesting username…</span>
            </p>
          )}
          {errors.username && (
            <p className="text-red-600 text-sm mt-1">
              {errors.username.message}
            </p>
          )}

          {!loadingSuggestions && suggestions.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 font-semibold text-white">Available:</p>
              <div className="flex flex-wrap gap-4">
                {suggestions.map((username) => {
                  const selected = currentUsername === username;
                  return (
                    <span
                      key={username}
                      onClick={() => onSuggestionClick(username)}
                      className={`cursor-pointer transition-colors ${
                        selected
                          ? "text-white font-bold"
                          : "text-white text-opacity-75 hover:text-opacity-100"
                      }`}
                    >
                      {username}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="phoneNumber">Phone Number (optional)</Label>
          <Input
            id="phoneNumber"
            type="tel"
            {...register("phoneNumber")}
            className="mt-1"
            autoComplete="tel"
            placeholder="+1234567890"
          />
          {errors.phoneNumber && (
            <p className="text-red-600 text-sm mt-1">
              {errors.phoneNumber.message}
            </p>
          )}
        </div>

        <Button type="submit" disabled={isSubmitting}>
          Complete Onboarding
        </Button>
      </form>
    </main>
  );
};

export default CompleteOnboarding;
