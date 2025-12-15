import ManagerDashboard from "@/components/ManagerDashboard";
import DashboardNav from "@/components/DashboardNav";

export default function ManagerDashboardPage() {
    return (
        <main className="min-h-screen gradient-bg">
            <DashboardNav />
            <div className="max-w-7xl mx-auto px-6 pt-24 pb-12">
                <ManagerDashboard />
            </div>
        </main>
    );
}
