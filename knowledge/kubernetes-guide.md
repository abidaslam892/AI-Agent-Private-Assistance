# Kubernetes Operations Guide

## Architecture
- **Control plane**: kube-apiserver, etcd (cluster state), kube-scheduler, kube-controller-manager.
- **Worker node**: kubelet, kube-proxy, container runtime (containerd).
- **Pod**: smallest deployable unit, one or more containers sharing network and storage.
- **ReplicaSet** maintains pod count; **Deployment** manages ReplicaSets and rolling updates; **StatefulSet** gives stable identity and storage (databases); **DaemonSet** runs one pod per node; **Job/CronJob** run batch tasks.
- **Service** gives a stable virtual IP: ClusterIP (internal), NodePort, LoadBalancer. **Ingress** routes HTTP(S) by host/path.
- **ConfigMap** holds config, **Secret** holds sensitive data, **PV/PVC/StorageClass** provide persistent storage.
- **Namespace** isolates resources; **RBAC** (Role, ClusterRole, RoleBinding) controls access.

## kubectl Cheat Sheet
- `kubectl get pods -A -o wide`, `kubectl get svc,deploy,ing -n prod`
- `kubectl describe pod <pod>` shows events (best first step for debugging).
- `kubectl logs -f <pod> -c <container> --previous` (previous crashed instance).
- `kubectl exec -it <pod> -- sh`
- `kubectl apply -f manifest.yaml`, `kubectl delete -f manifest.yaml`
- `kubectl scale deploy/api --replicas=5`
- `kubectl rollout status deploy/api`, `kubectl rollout undo deploy/api`, `kubectl rollout history deploy/api`
- `kubectl port-forward svc/api 8080:80`
- `kubectl top pods`, `kubectl top nodes` (needs metrics-server)
- `kubectl get events --sort-by=.metadata.creationTimestamp`
- `kubectl cordon|drain|uncordon <node>` for node maintenance.

## Example Deployment + Service
```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: api }
spec:
  replicas: 3
  selector: { matchLabels: { app: api } }
  strategy: { type: RollingUpdate, rollingUpdate: { maxUnavailable: 1, maxSurge: 1 } }
  template:
    metadata: { labels: { app: api } }
    spec:
      containers:
      - name: api
        image: registry.example.com/api:1.0
        ports: [{ containerPort: 8000 }]
        resources:
          requests: { cpu: 250m, memory: 256Mi }
          limits: { cpu: 500m, memory: 512Mi }
        readinessProbe: { httpGet: { path: /health, port: 8000 } }
        livenessProbe: { httpGet: { path: /health, port: 8000 }, initialDelaySeconds: 10 }
---
apiVersion: v1
kind: Service
metadata: { name: api }
spec:
  selector: { app: api }
  ports: [{ port: 80, targetPort: 8000 }]
```

## Troubleshooting Pod States
- **Pending**: no node fits (insufficient CPU/memory, taints, unbound PVC). Check `describe pod` events.
- **ImagePullBackOff / ErrImagePull**: wrong image name/tag or missing imagePullSecret.
- **CrashLoopBackOff**: container keeps crashing; check `logs --previous`, config, probes, resource limits.
- **OOMKilled**: memory limit exceeded; raise limit or fix leak.
- **CreateContainerConfigError**: missing ConfigMap/Secret key.
- **Service unreachable**: verify selector labels match pod labels (`kubectl get endpoints svc`), readiness passing, NetworkPolicy not blocking.
- **Node NotReady**: check kubelet, disk/memory pressure, network.

## Scaling and Reliability
- **HPA** autoscales pods on CPU/memory/custom metrics; **VPA** tunes requests; **Cluster Autoscaler** adds nodes.
- **PodDisruptionBudget** limits voluntary disruptions; use anti-affinity/topology spread for HA.
- Helm packages manifests as charts: `helm install rel chart -f values.yaml`, `helm upgrade --install`, `helm rollback`.
- Deploying telecom workloads (OCS, CRM, charging): use StatefulSets for stateful components (Redis, Kafka, databases), Deployments for stateless charging/rating microservices, HPA on TPS or CPU, and dedicated namespaces per environment.
