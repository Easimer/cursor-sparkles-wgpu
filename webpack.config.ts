import * as webpack from 'webpack';
import * as path from 'path';
import { argv } from 'process';

import { version } from './package.json';

const env = process.env['NODE_ENV'];
const isProduction =
    (env && env.match(/production/)) ||
    argv.reduce((prev, cur) => prev || cur === '--production', false);

const config: webpack.Configuration = {
    context: path.join(__dirname, 'src'),
    devtool: isProduction ? false : 'inline-source-map',
    entry: {
        app: './main.ts'
    },
    output: {
        filename: `cursor-sparkles-wgpu-${version}.js`,
        path: path.resolve(__dirname, 'dist'),
        library: 'cursorSparklesWgpu'
    },
    resolve: {
        extensions: ['.ts', '.tsx', 'js'],
        modules: [path.resolve(__dirname, 'src'), 'node_modules']
    },
    module: {
        rules: [
            {
                test: /\.ts/,
                exclude: /node_modules/,
                loader: 'ts-loader',
                options: {
                    transpileOnly: true,
                    compilerOptions: {
                        isolatedModules: true
                    },
                }
            },
            {
                test: /\.wgsl/,
                type: 'asset/source'
            }
        ]
    },
    node: false,
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(
                    isProduction ? 'production' : 'development'
                )
            }
        })
    ],
    optimization: {
        minimize: isProduction ? true : false
    },
};

const TAG = '[cursor-sparkles-wgpu]';

/**
 * Start Build
 */
const compiler: webpack.Compiler = webpack(config);

if (!argv.reduce((prev, cur) => prev || cur === '--watch', false)) {
    compiler.run((err, stats) => {
        if (err) return console.error(err);
        if (!stats) return console.error('stats was undefined');

        if (stats.hasErrors()) {
            console.error(TAG, 'Failed to compile:');
            const statsJson = stats.toJson();
            if (statsJson && statsJson.errors) {
                for (let error of statsJson.errors) {
                    console.error(error.message);
                }
            }

            return;
        }

        const timeElapsedMs = stats.endTime - stats.startTime;
        console.log(TAG, `Built ${isProduction ? 'prod' : 'dev'} in ${timeElapsedMs} ms`);
    });
} else {
    compiler.watch({}, (err, stats) => {
        if (err) return console.error(err);
        if (!stats) return console.error('stats was undefined');

        if (stats.hasErrors()) {
            console.error(TAG, 'Failed to compile:');
            const statsJson = stats.toJson();
            if (statsJson && statsJson.errors) {
                for (let error of statsJson.errors) {
                    console.log(error.message);
                }
            }
            console.log(TAG, 'Ready');
            return;
        }

        const timeElapsedMs = stats.endTime - stats.startTime;
        console.log(TAG, `Built ${isProduction ? 'prod' : 'dev'} in ${timeElapsedMs} ms`);
        console.log(TAG, 'Ready');
    });
}