import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Tooltip } from 'recharts';
import { Loader2, Activity, Database, BrainCircuit, RefreshCw, AlertTriangle, CheckCircle2, History, ArrowRightCircle } from "lucide-react";

export default function MLOpsDashboard() {
    const [healthData, setHealthData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [retraining, setRetraining] = useState(false);
    const [deploying, setDeploying] = useState(null);

    const fetchHealth = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/v1/mlops/health');
            const data = await res.json();
            setHealthData(data);
        } catch (err) {
            console.error("Failed to fetch MLOps health", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
    }, []);

    const handleRetrain = async () => {
        setRetraining(true);
        try {
            await fetch('http://localhost:8000/api/v1/mlops/retrain', { method: 'POST' });
            setTimeout(() => {
                setRetraining(false);
                alert("Model retraining pipeline initiated successfully via MLflow!");
            }, 2000);
        } catch (err) {
            console.error(err);
            setRetraining(false);
        }
    };

    const handleDeploy = async (version) => {
        if (!confirm(`Are you sure you want to rollback/deploy ${version} as the Champion model?`)) return;
        setDeploying(version);
        try {
            await fetch(`http://localhost:8000/api/v1/mlops/deploy/${version}`, { method: 'POST' });
            alert(`Successfully swapped MLflow alias. ${version} is now in Production!`);
            await fetchHealth(); // Refresh table
        } catch (err) {
            console.error(err);
        } finally {
            setDeploying(null);
        }
    };

    if (loading || !healthData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-4 text-primary">
                <Loader2 className="w-12 h-12 animate-spin" />
                <h2 className="text-xl font-bold animate-pulse">Querying DagsHub MLflow & PostgreSQL...</h2>
            </div>
        );
    }

    const { model_info, metrics, drift_data, history } = healthData;
    const isDriftDetected = drift_data.drift_detected;
    
    const driftPercentage = drift_data.training_baseline > 0 
        ? ((drift_data.live_average - drift_data.training_baseline) / drift_data.training_baseline) * 100 
        : 0;

    const chartData = [
        { name: 'Training Avg Hourly Demand', value: drift_data.training_baseline },
        { name: 'Live 24h Avg Hourly Demand', value: drift_data.live_average }
    ];

    return (
        <div className="p-6 flex flex-col min-h-[calc(100vh-2rem)] space-y-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <BrainCircuit className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">MLOps Health</h1>
                        <p className="text-sm text-muted-foreground">Monitor production models and detect data drift dynamically via MLflow & PostgreSQL.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* ACTIVE MODEL INFO CARD */}
                <Card className="border-border/40 bg-card/40 backdrop-blur shadow-sm">
                    <CardHeader className="pb-3 border-b border-border/20">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-500" />
                                Active Model Registry
                            </CardTitle>
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                {model_info.status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Model Name</p>
                                <p className="font-mono font-medium">{model_info.name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Version</p>
                                <p className="font-mono font-medium">{model_info.version}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Framework</p>
                                <p className="font-medium">{model_info.framework}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Last Trained</p>
                                <p className="font-medium text-sm">{new Date(model_info.last_trained).toLocaleString()}</p>
                            </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-border/20 grid grid-cols-3 gap-2 text-center">
                            <div className="bg-background/50 rounded p-2">
                                <p className="text-xs text-muted-foreground mb-1">RMSE</p>
                                <p className="font-bold text-primary">{metrics.rmse}</p>
                            </div>
                            <div className="bg-background/50 rounded p-2">
                                <p className="text-xs text-muted-foreground mb-1">MAE</p>
                                <p className="font-bold text-primary">{metrics.mae}</p>
                            </div>
                            <div className="bg-background/50 rounded p-2">
                                <p className="text-xs text-muted-foreground mb-1">R² Score</p>
                                <p className="font-bold text-primary">{metrics.r2_score}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* DATA DRIFT CARD */}
                <Card className={`border-border/40 bg-card/40 backdrop-blur shadow-sm transition-colors ${isDriftDetected ? 'border-red-500/50 shadow-red-500/10' : ''}`}>
                    <CardHeader className="pb-3 border-b border-border/20">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Database className="w-5 h-5 text-purple-500" />
                                Real-Time Data Drift Monitor
                            </CardTitle>
                            {isDriftDetected ? (
                                <Badge variant="destructive" className="animate-pulse">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    High Drift
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                    Normal
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 flex flex-col items-center">
                        <div className="w-full flex justify-between items-center mb-2 px-4">
                            <p className="text-sm text-muted-foreground">Volume Distribution Comparison</p>
                            {isDriftDetected && (
                                <span className="text-xs font-black text-red-500 bg-red-500/10 px-2 py-1 rounded">
                                    +{driftPercentage.toFixed(1)}% SHIFT
                                </span>
                            )}
                        </div>
                        <div className="w-full h-[200px]">
                            <BarChart width={380} height={200} data={chartData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    cursor={{fill: '#222'}}
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#a1a1aa' }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.name === 'Live 24h Avg Hourly Demand' && isDriftDetected ? '#ef4444' : '#3b82f6'} 
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </div>

                        <div className="w-full mt-4 flex items-center gap-4">
                            <Button 
                                onClick={handleRetrain} 
                                disabled={retraining}
                                className={`w-full ${isDriftDetected ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
                            >
                                {retraining ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Triggering MLflow Pipeline...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Trigger Model Retraining
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* MODEL VERSION HISTORY */}
            <Card className="border-border/40 bg-card/40 backdrop-blur shadow-sm">
                <CardHeader className="pb-3 border-b border-border/20">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-400" />
                        Model Version History (DagsHub Registry)
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border/20">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Version</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">RMSE</th>
                                    <th className="px-4 py-3">R² Score</th>
                                    <th className="px-4 py-3">Trained On</th>
                                    <th className="px-4 py-3 rounded-tr-lg text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history && history.length > 0 ? history.map((model, idx) => (
                                    <tr key={idx} className="border-b border-border/10 hover:bg-background/30 transition-colors">
                                        <td className="px-4 py-3 font-mono font-medium">{model.version}</td>
                                        <td className="px-4 py-3">
                                            {model.status.includes('Champion') ? (
                                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Champion</Badge>
                                            ) : model.status === 'Archived' ? (
                                                <Badge variant="outline" className="text-gray-500 border-gray-500/20">Archived</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{model.status}</Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">{model.rmse}</td>
                                        <td className="px-4 py-3">{model.r2_score}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{model.last_trained !== 'Unknown' ? new Date(model.last_trained).toLocaleString() : 'Unknown'}</td>
                                        <td className="px-4 py-3 text-right">
                                            {!model.status.includes('Champion') && (
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm"
                                                    disabled={deploying === model.version}
                                                    onClick={() => handleDeploy(model.version)}
                                                >
                                                    {deploying === model.version ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightCircle className="w-4 h-4 mr-1" />}
                                                    Deploy
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="6" className="text-center py-6 text-muted-foreground">No model history found in MLflow.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}
