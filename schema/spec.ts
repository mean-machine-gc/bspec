import { LifecycleSpec as LifecycleNext} from "./lifecycle/next/lifecycle"
import { LifecycleSpec as LifecycleV10 } from "./lifecycle/v1-0/lifecycle"
import { ProcessSpec as ProcessNext } from "./process/next/process"
import { ProcessSpec as ProcessV10 } from "./process/v1-0/process"
import { SystemSpec } from "./system/v1-0/system"

type Version = {
    version: string,
    stable: boolean,
    zodSchema: any
}

type Spec = {
    name: string,
    description: string,
    versions: Version[]
}

const lifecycleVersions: Version[] = [
    {
        version: 'v1-0',
        stable: true,
        zodSchema: LifecycleV10
    },
    {
        version: 'next',
        stable: false,
        zodSchema: LifecycleNext
    },
]

const lifecycleSpec: Spec = {
    name: 'lifecycle',
    description: 'Models aggregates process',
    versions: lifecycleVersions
}

const processVersions: Version[] = [
    {
        version: 'v1-0',
        stable: true,
        zodSchema: ProcessV10
    },
    {
        version: 'next',
        stable: false,
        zodSchema: ProcessNext
    },
]

const processSpec: Spec = {
    name: 'process',
    description: 'Models aggregates process',
    versions: processVersions
}

const systemVersions: Version[] = [
    {
        version: 'v1-0',
        stable: true,
        zodSchema: SystemSpec
    },
]

const systemSpec: Spec = {
    name: 'system',
    description: 'Models a system with modules and cross-module messaging',
    versions: systemVersions
}

export const spec: Spec[] = [
    lifecycleSpec,
    processSpec,
    systemSpec
]