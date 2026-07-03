import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ModernFormLayout() {
  return (
    <div className="w-full rounded-3xl border border-border/60 bg-card/60 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-blue-400">
            Employee Profile
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Personal & Contact Details
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Capture key employee information in a clean, two-column layout designed for quick data entry and review.
          </p>
        </div>

        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="pb-2 px-0">
            <div className="grid gap-3 md:grid-cols-2 md:items-end">
              <div className="space-y-1.5">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Basic Information
                </CardTitle>
                <CardDescription>
                  Name and identification details used across the HRIS.
                </CardDescription>
              </div>
              <div className="space-y-1.5 md:text-right">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Contact Details
                </CardTitle>
                <CardDescription>
                  How we reach this employee and where they&apos;re based.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-0 pt-4">
            <div className="grid gap-8 md:grid-cols-2">
              {/* Left column – basic info */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="employee-id">
                    Employee ID <span className="text-destructive">*</span>
                  </Label>
                  <Input id="employee-id" placeholder="e.g. EMP-00123" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="first-name">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input id="first-name" placeholder="First name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last-name">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input id="last-name" placeholder="Last name" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="job-title">Job Title</Label>
                  <Input id="job-title" placeholder="e.g. HR Specialist" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="employment-status">Employment Status</Label>
                    <Input
                      id="employment-status"
                      placeholder="e.g. Full-time"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      placeholder="e.g. People Operations"
                    />
                  </div>
                </div>
              </div>

              {/* Right column – address / contact */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="work-email">
                    Work Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="work-email"
                    type="email"
                    placeholder="name@company.com"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="work-phone">Work Phone</Label>
                    <Input id="work-phone" placeholder="+63 900 000 0000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="personal-phone">Personal Phone</Label>
                    <Input id="personal-phone" placeholder="+63 900 000 0000" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address-line-1">
                    Address Line 1 <span className="text-destructive">*</span>
                  </Label>
                  <Input id="address-line-1" placeholder="Street, building, etc." />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="City" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="state">State / Province</Label>
                    <Input id="state" placeholder="State or province" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="postal-code">Postal Code</Label>
                    <Input id="postal-code" placeholder="ZIP / postal" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="px-0 pt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Fields marked with <span className="text-destructive">*</span> are required.
            </p>
            <Button size="lg" className="px-8 rounded-full">
              Save Profile
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

